import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[extract-document-data] Received ${req.method} request`);
    const { imageBase64, documentType } = await req.json();
    console.log(`[extract-document-data] Parsed request. imageBase64 length: ${imageBase64 ? imageBase64.length : 0}, documentType: ${documentType}`);

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64 in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    console.log(`[extract-document-data] GEMINI_API_KEY is set: ${!!GEMINI_API_KEY}, length: ${GEMINI_API_KEY ? GEMINI_API_KEY.length : 0}`);
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    // Prepare the system prompt based on document type
    let systemInstruction = "You are a highly accurate data extraction assistant. Extract the requested fields from the provided document image. You MUST return ONLY valid JSON matching the schema, with no markdown formatting or backticks.";
    let jsonSchema = {};

    if (documentType === "certificate") {
      jsonSchema = {
        type: "object",
        properties: {
          title: { type: "string", description: "The name or title of the certificate/course" },
          issuing_organization: { type: "string", description: "The organization that issued the certificate" },
          issue_date: { type: "string", description: "The date of issue (YYYY-MM-DD)" },
          expiry_date: { type: "string", description: "The expiry date if any (YYYY-MM-DD), or null" },
          credential_url: { type: "string", description: "Any URL for the credential, or null" },
          certificate_id: { type: "string", description: "The credential ID or certificate number, or null" }
        },
        required: ["title", "issuing_organization"]
      };
    } else if (documentType === "card") {
      jsonSchema = {
        type: "object",
        properties: {
          bank: { type: "string", description: "The issuing bank or organization" },
          cardholder_name: { type: "string", description: "The name of the cardholder" },
          card_number: { type: "string", description: "The full card number, stripped of spaces" },
          expiry_date: { type: "string", description: "The expiration date (MM/YY or MM/YYYY)" },
          card_type: { type: "string", description: "The type of card (e.g., Credit, Debit, Visa, Mastercard)" }
        },
        required: ["card_number"]
      };
    } else {
      // Fallback generic schema
      jsonSchema = {
        type: "object",
        properties: {
          extracted_text: { type: "string" }
        }
      };
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiRequestBody = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "image/jpeg", // We'll assume jpeg/png base64 is passed correctly
                data: imageBase64
              }
            },
            {
              text: "Extract the exact structured data from this image."
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
        temperature: 0.1, // Low temperature for factual extraction
        maxOutputTokens: 2048, // Increased to prevent truncated responses
      }
    };

    console.log(`[extract-document-data] Sending request to Gemini API...`);
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiRequestBody),
    });

    console.log(`[extract-document-data] Gemini API responded with status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[extract-document-data] Gemini API Failed - Raw Response Body:`, errorData);
      throw new Error(`Gemini API returned status ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // The response is guaranteed to be a JSON string inside the text part due to response_mime_type
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error(`Gemini API returned no candidates. Full response: ${JSON.stringify(data)}`);
    }

    const extractedJsonString = candidates[0].content?.parts?.[0]?.text;
    if (!extractedJsonString) {
      throw new Error(`Gemini API returned empty text. Full response: ${JSON.stringify(data)}`);
    }
    
    // Clean up markdown wrappers (in case the API ignores responseMimeType and returns markdown)
    const cleanJsonText = extractedJsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let extractedData;
    try {
      extractedData = JSON.parse(cleanJsonText);
    } catch (parseError) {
      console.error(`[extract-document-data] JSON Parse Error:`, parseError);
      console.error(`[extract-document-data] Raw Text attempting to parse:`, cleanJsonText);
      throw new Error(`Failed to parse AI response into valid JSON: ${parseError.message}`);
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[extract-document-data] Caught Runtime Error:`, error);
    console.error(`[extract-document-data] Error Message:`, errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(`[extract-document-data] Stack Trace:`, error.stack);
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
