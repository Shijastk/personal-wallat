/*
# Final Telegram Architecture

1. Changes
- Modify `telegram_link_tokens` to use `status` ('ACTIVE', 'REVOKED') instead of `used`.
- Update `link_telegram_account` to allow infinite token reuse and prevent connection hijacking.
- Create `telegram_intake_sessions` for stateful multi-step Telegram uploads (secured via RLS deny-all).
*/

-- 1. Update Token Lifecycle
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';

-- Safely migrate existing used tokens to REVOKED status
UPDATE telegram_link_tokens SET status = 'REVOKED' WHERE used = true;

-- 2. Create Intake Sessions Table
CREATE TABLE IF NOT EXISTS telegram_intake_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id text NOT NULL,
    state text NOT NULL DEFAULT 'awaiting_category',
    file_id text,
    file_name text,
    category text,
    title text,
    created_at timestamptz DEFAULT now()
);

-- Deny all client access to intake sessions (Service Role / Webhook only)
ALTER TABLE telegram_intake_sessions ENABLE ROW LEVEL SECURITY;
-- By NOT creating any policies, default-deny is enforced for authenticated and anon users.

-- 3. Update RPC for Indefinite ACTIVE tokens & anti-hijacking
CREATE OR REPLACE FUNCTION link_telegram_account(p_token text, p_chat_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_status text;
    v_existing_profile_user_id uuid;
BEGIN
    -- 1. Select the token WITH (UPDLOCK) to prevent concurrent modifications
    SELECT user_id, status 
    INTO v_user_id, v_status
    FROM telegram_link_tokens
    WHERE token = p_token
    FOR UPDATE;

    -- 2. Token validation
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_TOKEN';
    END IF;

    IF v_status = 'REVOKED' THEN
        RAISE EXCEPTION 'USED_TOKEN'; -- using USED_TOKEN to maintain webhook error handling compatibility
    END IF;

    -- Note: We ignore expires_at completely per final requirements.

    -- 3. Check for silent connection hijacking
    -- Does this chat_id already belong to another user's profile?
    SELECT user_id INTO v_existing_profile_user_id
    FROM profiles
    WHERE telegram_chat_id = p_chat_id;

    IF FOUND AND v_existing_profile_user_id != v_user_id THEN
        RAISE EXCEPTION 'CHAT_ID_ALREADY_LINKED';
    END IF;

    -- 4. Update profile or create if missing
    UPDATE profiles
    SET telegram_chat_id = p_chat_id
    WHERE user_id = v_user_id;

    -- If no profile exists for this user_id, create it now
    IF NOT FOUND THEN
        INSERT INTO profiles (user_id, telegram_chat_id)
        VALUES (v_user_id, p_chat_id);
    END IF;

    -- Note: We DO NOT revoke or mark the token as used. It remains ACTIVE indefinitely.

    -- Return the securely linked user_id
    RETURN v_user_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'CHAT_ID_ALREADY_LINKED';
END;
$$;
