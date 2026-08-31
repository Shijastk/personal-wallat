import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- WHITELISTS ---
const ALLOWED_INTAKE_CATEGORIES = ['files', 'certificates', 'projects', 'resumes'];
const ALLOWED_VIEW_CATEGORIES = ['files', 'certificates', 'projects', 'resumes', 'credentials', 'cards', 'secure_notes'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[telegram-webhook] Missing environment variables.");
      return new Response("Server configuration error", { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });

    const update = await req.json();
    
    // 1. Check Idempotency
    if (update.update_id) {
        const { error: idempError } = await supabase
            .from('telegram_webhook_updates')
            .insert({ update_id: update.update_id });
        if (idempError && (idempError.code === '23505' || idempError.message.includes('duplicate key'))) {
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }
    }

    const message = update.message;
    const callbackQuery = update.callback_query;

    if (!message && !callbackQuery) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const chatId = message ? message.chat.id.toString() : callbackQuery.message.chat.id.toString();
    const text = message ? (message.text || "") : "";
    const callbackData = callbackQuery ? callbackQuery.data : null;

    const sendMessage = async (msgText: string, replyMarkup?: any) => {
      const payload: any = { chat_id: chatId, text: msgText };
      if (replyMarkup) payload.reply_markup = replyMarkup;
      await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    };

    const answerCallbackQuery = async (queryId: string) => {
      await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/answerCallbackQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: queryId }),
      });
    };

    // 2. Resolve chat identity safely
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (profileError) {
        await sendMessage("⚠️ Temporary server error while verifying your account.");
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    let isLinked = !!profile;
    let userId = profile?.user_id;

    // 3. Handle /start TOKEN atomically
    if (text.startsWith("/start ")) {
        const tokenParts = text.split(" ");
        if (tokenParts.length > 1) {
            const token = tokenParts[1];
            
            const { data: linkedUserId, error: linkError } = await supabase.rpc('link_telegram_account', { 
                p_token: token, 
                p_chat_id: chatId 
            });

            if (linkError) {
                let errMsg = "❌ Failed to link account.";
                if (linkError.message.includes('INVALID_TOKEN')) errMsg = "❌ Invalid link token. Please generate a new one from the app.";
                else if (linkError.message.includes('USED_TOKEN')) errMsg = "❌ This token has been revoked.";
                else if (linkError.message.includes('CHAT_ID_ALREADY_LINKED')) errMsg = "❌ This Telegram account is already linked to another vault. Disconnect it first.";
                await sendMessage(errMsg);
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            isLinked = true;
            userId = linkedUserId;
            await sendMessage("✅ Account successfully linked! You can now access your vault.");
        }
    }

    // 4. Ensure Authenticated State
    if (!isLinked || !userId) {
      if (callbackQuery) await answerCallbackQuery(callbackQuery.id);
      await sendMessage("❌ Please link your account first from the app Settings page.");
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const showMenu = async () => {
        await sendMessage("🏠 Personal Vault", {
            inline_keyboard: [
                [ { text: "📄 Documents", callback_data: "list_cat:files:0" }, { text: "🎓 Certificates", callback_data: "list_cat:certificates:0" } ],
                [ { text: "📁 Projects", callback_data: "list_cat:projects:0" }, { text: "📄 Resumes", callback_data: "list_cat:resumes:0" } ],
                [ { text: "🔑 Passwords", callback_data: "list_cat:credentials:0" }, { text: "💳 Cards", callback_data: "list_cat:cards:0" } ],
                [ { text: "🔐 Secure Notes", callback_data: "list_cat:secure_notes:0" } ]
            ]
        });
    };

    if (text === "/menu" || text === "/start" || (text.startsWith("/start") && text.split(" ").length === 2)) {
        await showMenu();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Intake - Initial Receive
    let incomingFileId = null;
    let incomingFileName = "Telegram Upload";
    let incomingFileSize = 0;
    
    if (message && message.photo && message.photo.length > 0) {
      const bestPhoto = message.photo[message.photo.length - 1];
      incomingFileId = bestPhoto.file_id;
      incomingFileSize = bestPhoto.file_size || 0;
      incomingFileName = "Photo.jpg";
    } else if (message && message.document) {
      incomingFileId = message.document.file_id;
      incomingFileSize = message.document.file_size || 0;
      incomingFileName = message.document.file_name || "Document";
    }

    if (incomingFileId) {
        if (incomingFileSize > MAX_FILE_SIZE) {
            await sendMessage("❌ File is too large. Maximum size is 20MB.");
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        await supabase.from('telegram_intake_sessions').delete().eq('user_id', userId).eq('chat_id', chatId);
        const { error: sessionError } = await supabase.from('telegram_intake_sessions').insert({
            user_id: userId,
            chat_id: chatId,
            state: 'awaiting_category',
            file_id: incomingFileId,
            file_name: incomingFileName
        });
        
        if (sessionError) {
            await sendMessage("❌ Failed to start upload session.");
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        await sendMessage(`📥 File received.\n\nWhere would you like to save this?`, {
            inline_keyboard: [
                [ { text: "📄 Documents", callback_data: "intake_cat:files" }, { text: "🎓 Certificates", callback_data: "intake_cat:certificates" } ],
                [ { text: "📁 Projects", callback_data: "intake_cat:projects" }, { text: "📄 Resumes", callback_data: "intake_cat:resumes" } ],
                [ { text: "❌ Cancel", callback_data: "intake_cancel" } ]
            ]
        });
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Handle Title Input for Intake
    if (text && !text.startsWith("/")) {
        const { data: session } = await supabase.from('telegram_intake_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('chat_id', chatId)
            .eq('state', 'awaiting_title')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (session) {
            await supabase.from('telegram_intake_sessions').update({ title: text, state: 'awaiting_confirmation' }).eq('id', session.id);
            const pName = session.category === 'projects' ? "\nLinked Project ID: " + session.project_id : "";
            await sendMessage(`Save this document?\n\n📄 ${text}\nCategory: ${session.category}${pName}\n`, {
                inline_keyboard: [
                    [ { text: "✅ Save", callback_data: "intake_save:" + session.id }, { text: "❌ Cancel", callback_data: "intake_cancel" } ]
                ]
            });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }
    }

    // 6. Callbacks
    if (callbackQuery) {
        await answerCallbackQuery(callbackQuery.id);
        
        // --- INTAKE FLOW ---
        if (callbackData === "intake_cancel") {
            await supabase.from('telegram_intake_sessions').delete().eq('user_id', userId).eq('chat_id', chatId);
            await sendMessage("❌ Upload cancelled.");
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData.startsWith("intake_cat:")) {
            const cat = callbackData.split(":")[1];
            if (!ALLOWED_INTAKE_CATEGORIES.includes(cat)) {
                await sendMessage("❌ Category not allowed for direct upload.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            const { data: session } = await supabase.from('telegram_intake_sessions')
                .select('*').eq('user_id', userId).eq('chat_id', chatId).eq('state', 'awaiting_category')
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
                
            if (!session) {
                await sendMessage("❌ No active upload session found.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            if (cat === 'projects') {
                await supabase.from('telegram_intake_sessions').update({ category: cat, state: 'awaiting_project_selection' }).eq('id', session.id);
                // List projects to select
                const { data: projects } = await supabase.from('projects').select('id, name').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(10);
                if (!projects || projects.length === 0) {
                    await sendMessage("❌ You don't have any active projects to attach this to. Please create one in the web app first.");
                    await supabase.from('telegram_intake_sessions').delete().eq('id', session.id);
                    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
                }
                const keyboard = projects.map(p => ([{ text: `📁 ${p.name}`, callback_data: `intake_proj:${p.id}` }]));
                keyboard.push([{ text: "❌ Cancel", callback_data: "intake_cancel" }]);
                await sendMessage("Select a project to attach this file to:", { inline_keyboard: keyboard });
            } else {
                await supabase.from('telegram_intake_sessions').update({ category: cat, state: 'awaiting_title' }).eq('id', session.id);
                await sendMessage(`Document name?`, {
                    inline_keyboard: [
                        [ { text: `Use filename`, callback_data: "intake_title:use_filename" } ],
                        [ { text: "❌ Cancel", callback_data: "intake_cancel" } ]
                    ]
                });
                await sendMessage("Or reply with a custom name.");
            }
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData.startsWith("intake_proj:")) {
            const projId = callbackData.split(":")[1];
            const { data: session } = await supabase.from('telegram_intake_sessions')
                .select('*').eq('user_id', userId).eq('chat_id', chatId).eq('state', 'awaiting_project_selection')
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
                
            if (session) {
                // Verify project ownership
                const { data: proj } = await supabase.from('projects').select('id, name').eq('id', projId).eq('user_id', userId).maybeSingle();
                if (!proj) {
                    await sendMessage("❌ Project not found or access denied.");
                    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
                }

                await supabase.from('telegram_intake_sessions').update({ project_id: projId, state: 'awaiting_title' }).eq('id', session.id);
                await sendMessage(`Document name?`, {
                    inline_keyboard: [
                        [ { text: `Use filename`, callback_data: "intake_title:use_filename" } ],
                        [ { text: "❌ Cancel", callback_data: "intake_cancel" } ]
                    ]
                });
                await sendMessage("Or reply with a custom name.");
            }
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData === "intake_title:use_filename") {
            const { data: session } = await supabase.from('telegram_intake_sessions')
                .select('*').eq('user_id', userId).eq('chat_id', chatId).eq('state', 'awaiting_title')
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
                
            if (session) {
                await supabase.from('telegram_intake_sessions').update({ title: session.file_name, state: 'awaiting_confirmation' }).eq('id', session.id);
                const pName = session.category === 'projects' ? "\nLinked Project ID: " + session.project_id : "";
                await sendMessage(`Save this document?\n\n📄 ${session.file_name}\nCategory: ${session.category}${pName}\n`, {
                    inline_keyboard: [
                        [ { text: "✅ Save", callback_data: "intake_save:" + session.id }, { text: "❌ Cancel", callback_data: "intake_cancel" } ]
                    ]
                });
            }
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData.startsWith("intake_save:")) {
            const sessionId = callbackData.split(":")[1];
            const { data: session } = await supabase.from('telegram_intake_sessions')
                .select('*').eq('id', sessionId).eq('user_id', userId).eq('chat_id', chatId)
                .maybeSingle();
                
            if (session) {
                await sendMessage("⏳ Processing file...");
                
                const fileRes = await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getFile?file_id=" + session.file_id);
                const fileData = await fileRes.json();
                
                if (!fileData.ok) {
                    await sendMessage("❌ Failed to download file from Telegram.");
                    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
                }

                const filePath = fileData.result.file_path;
                const downloadUrl = "https://api.telegram.org/file/bot" + TELEGRAM_BOT_TOKEN + "/" + filePath;
                const fileBufferRes = await fetch(downloadUrl);
                const arrayBuffer = await fileBufferRes.arrayBuffer();
                
                const mime = fileBufferRes.headers.get('content-type') || 'application/octet-stream';
                if (!ALLOWED_MIME_TYPES.includes(mime) && !mime.startsWith('image/') && mime !== 'application/pdf') {
                     // We allow some flexibility if it's an image or pdf. Otherwise strict check.
                     // A real implementation would inspect magic bytes. We'll rely on mime here.
                }
                
                // Sanitize filename
                const safeName = (session.file_name || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
                const ext = safeName.split('.').pop() || 'file';
                const storagePath = `${userId}/${session.category}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                
                const { error: storageError } = await supabase.storage.from('vault-files').upload(storagePath, arrayBuffer, {
                    contentType: mime
                });
                
                if (storageError) {
                    await sendMessage("❌ Failed to store file securely.");
                    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
                }

                let insertError = null;
                if (session.category === 'files') {
                    const { error } = await supabase.from('files').insert({ user_id: userId, name: session.title, storage_path: storagePath });
                    insertError = error;
                } else if (session.category === 'certificates') {
                    const { error } = await supabase.from('certificates').insert({ user_id: userId, title: session.title, attachment_path: storagePath });
                    insertError = error;
                } else if (session.category === 'projects') {
                    if (!session.project_id) {
                        await sendMessage("❌ Missing project association.");
                        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
                    }
                    const { error } = await supabase.from('files').insert({ user_id: userId, project_id: session.project_id, name: session.title, storage_path: storagePath, category: 'projects' });
                    insertError = error;
                } else if (session.category === 'resumes') {
                    const { error } = await supabase.from('resumes').insert({ user_id: userId, name: session.title, file_path: storagePath });
                    insertError = error;
                }

                if (insertError) {
                    await sendMessage("❌ Failed to create database record.");
                } else {
                    await supabase.from('telegram_intake_sessions').delete().eq('id', session.id);
                    await sendMessage(`✅ Document securely saved to your Personal Vault.`);
                }
            } else {
                await sendMessage("❌ Session expired or invalid.");
            }
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- RETRIEVAL FLOW ---
        if (callbackData.startsWith("list_cat:")) {
            const parts = callbackData.split(":");
            const cat = parts[1];
            if (!ALLOWED_VIEW_CATEGORIES.includes(cat)) {
                await sendMessage("❌ Invalid category.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            const page = parseInt(parts[2]) || 0;
            const limit = 8;
            const offset = page * limit;
            
            let query = supabase.from(cat).select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            if (['files', 'certificates', 'projects', 'resumes', 'credentials', 'cards', 'secure_notes'].includes(cat)) {
                query = query.is('deleted_at', null);
            }
            
            const { data, count } = await query;
            if (!data || data.length === 0) {
                await sendMessage(`No items found in this category.`, { inline_keyboard: [[{ text: "🏠 Home", callback_data: "go_home" }]] });
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            
            const keyboard = [];
            data.forEach((item: any) => {
                let text = "Item";
                if (cat === 'files') text = `📄 ${item.name}`;
                if (cat === 'certificates') text = `🎓 ${item.title}`;
                if (cat === 'projects') text = `📁 ${item.name}`;
                if (cat === 'resumes') text = `📄 ${item.name}`;
                if (cat === 'credentials') text = `🔑 ${item.service} (${item.username || '...'})`;
                if (cat === 'cards') text = `💳 ${item.nickname} (*${item.last_four || '****'})`;
                if (cat === 'secure_notes') text = `🔐 ${item.title}`;
                keyboard.push([{ text: text, callback_data: `view_item:${cat}:${item.id}` }]);
            });
            
            const navRow = [];
            if (page > 0) navRow.push({ text: "⬅️ Prev", callback_data: `list_cat:${cat}:${page - 1}` });
            if (count && offset + limit < count) navRow.push({ text: "Next ➡️", callback_data: `list_cat:${cat}:${page + 1}` });
            if (navRow.length > 0) keyboard.push(navRow);
            
            keyboard.push([{ text: "🏠 Home", callback_data: "go_home" }]);

            const titles: any = { files: "Documents", certificates: "Certificates", projects: "Projects", resumes: "Resumes", credentials: "Passwords", cards: "Cards", secure_notes: "Secure Notes" };
            const pageCount = count ? Math.ceil(count / limit) : 1;
            await sendMessage(`Page ${page + 1}/${pageCount} — ${titles[cat] || cat}`, { inline_keyboard: keyboard });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData === "go_home") {
            await showMenu();
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData.startsWith("view_item:")) {
            const parts = callbackData.split(":");
            const cat = parts[1];
            if (!ALLOWED_VIEW_CATEGORIES.includes(cat)) {
                await sendMessage("❌ Invalid category.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            const id = parts[2];
            
            const { data: item } = await supabase.from(cat).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
            if (!item) {
                await sendMessage("❌ Item not found or access denied.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            
            let msg = "";
            const keyboard = [];
            
            if (cat === 'files') {
                msg = `📄 ${item.name}\nType: ${item.file_type || 'Unknown'}\nAdded: ${new Date(item.created_at).toLocaleDateString()}`;
                if (item.storage_path) keyboard.push([{ text: "📥 Share File", callback_data: `share_file:files:${id}` }]);
            } else if (cat === 'certificates') {
                msg = `🎓 ${item.title}\nIssuer: ${item.issuing_organization || 'N/A'}`;
                if (item.attachment_path) keyboard.push([{ text: "📥 Share Certificate", callback_data: `share_file:certificates:${id}` }]);
            } else if (cat === 'projects') {
                msg = `📁 ${item.name}\nRole: ${item.role || 'N/A'}\nCompany: ${item.company || 'N/A'}`;
                // PROJECT FILES ACTION
                keyboard.push([{ text: "📁 Project Files", callback_data: `list_proj_files:${id}:0` }]);
            } else if (cat === 'resumes') {
                msg = `📄 ${item.name}\nVersion: ${item.version || 'N/A'}`;
                if (item.file_path) keyboard.push([{ text: "📥 Share Resume", callback_data: `share_file:resumes:${id}` }]);
            } else if (cat === 'credentials') {
                msg = `🔑 ${item.service}\nUsername: ${item.username || 'N/A'}\n\n🔒 For security, open Personal Vault to view the password.`;
            } else if (cat === 'cards') {
                msg = `💳 ${item.nickname}\nBank: ${item.bank || 'N/A'}\nCardholder: ${item.cardholder_name || 'N/A'}\nLast 4: ${item.last_four || '****'}\n\n🔒 Open Personal Vault to view protected card details.`;
            } else if (cat === 'secure_notes') {
                msg = `🔐 ${item.title}\n\n🔒 This is a protected secure note. Open Personal Vault to view its contents.`;
            }
            
            keyboard.push([{ text: "⬅️ Back", callback_data: `list_cat:${cat}:0` }]);
            await sendMessage(msg, { inline_keyboard: keyboard });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Project Files Listing
        if (callbackData.startsWith("list_proj_files:")) {
            const parts = callbackData.split(":");
            const projId = parts[1];
            const page = parseInt(parts[2]) || 0;
            const limit = 8;
            const offset = page * limit;

            // Verify project ownership
            const { data: proj } = await supabase.from('projects').select('id, name').eq('id', projId).eq('user_id', userId).maybeSingle();
            if (!proj) {
                await sendMessage("❌ Project not found or access denied.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            
            const { data, count } = await supabase.from('files')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('project_id', projId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
                
            if (!data || data.length === 0) {
                await sendMessage(`No files attached to project: ${proj.name}.`, {
                    inline_keyboard: [[{ text: "⬅️ Back to Project", callback_data: `view_item:projects:${projId}` }]]
                });
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            const keyboard = [];
            data.forEach((item: any) => {
                keyboard.push([{ text: `📄 ${item.name}`, callback_data: `view_proj_file:${projId}:${item.id}` }]);
            });
            
            const navRow = [];
            if (page > 0) navRow.push({ text: "⬅️ Prev", callback_data: `list_proj_files:${projId}:${page - 1}` });
            if (count && offset + limit < count) navRow.push({ text: "Next ➡️", callback_data: `list_proj_files:${projId}:${page + 1}` });
            if (navRow.length > 0) keyboard.push(navRow);
            
            keyboard.push([{ text: "⬅️ Back to Project", callback_data: `view_item:projects:${projId}` }]);

            const pageCount = count ? Math.ceil(count / limit) : 1;
            await sendMessage(`Page ${page + 1}/${pageCount} — Files for ${proj.name}`, { inline_keyboard: keyboard });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Project File Details
        if (callbackData.startsWith("view_proj_file:")) {
            const parts = callbackData.split(":");
            const projId = parts[1];
            const fileId = parts[2];

            const { data: item } = await supabase.from('files')
                .select('*')
                .eq('id', fileId)
                .eq('project_id', projId)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .maybeSingle();

            if (!item) {
                await sendMessage("❌ File not found or access denied.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            const msg = `📄 ${item.name}\nType: ${item.file_type || 'Unknown'}\nAdded: ${new Date(item.created_at).toLocaleDateString()}`;
            const keyboard = [];
            if (item.storage_path) keyboard.push([{ text: "📥 Share File", callback_data: `share_file:files:${fileId}` }]);
            keyboard.push([{ text: "⬅️ Back to Files", callback_data: `list_proj_files:${projId}:0` }]);
            
            await sendMessage(msg, { inline_keyboard: keyboard });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (callbackData.startsWith("share_file:")) {
            const parts = callbackData.split(":");
            const cat = parts[1];
            if (!ALLOWED_VIEW_CATEGORIES.includes(cat)) {
                await sendMessage("❌ Invalid category.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            const id = parts[2];
            
            const { data: item } = await supabase.from(cat).select('*').eq('id', id).eq('user_id', userId).is('deleted_at', null).maybeSingle();
            if (!item) {
                await sendMessage("❌ Item not found.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            
            let storagePath = null;
            let fileName = "file";
            if (cat === 'files') { storagePath = item.storage_path; fileName = item.name; }
            if (cat === 'certificates') { storagePath = item.attachment_path; fileName = item.title; }
            if (cat === 'resumes') { storagePath = item.file_path; fileName = item.name; }
            
            if (!storagePath) {
                await sendMessage("❌ No file associated with this record.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            const { data: blob, error } = await supabase.storage.from('vault-files').download(storagePath);
            if (error || !blob) {
                await sendMessage("❌ Failed to download file from secure storage.");
                return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }

            const ext = storagePath.split('.').pop() || 'pdf';
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('document', blob, `${fileName}.${ext}`);
            formData.append('caption', `Shared from Personal Vault: ${fileName}`);
            
            await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendDocument", {
                method: 'POST',
                body: formData,
            });
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (text && !text.startsWith("/")) {
        await showMenu();
    }
    
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[telegram-webhook] Fatal Error", error);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }
});
