/*
# Telegram Webhook Fixes Migration

1. Changes
- Add UNIQUE constraint to profiles(telegram_chat_id)
- Create telegram_webhook_updates table for idempotency
- Create link_telegram_account RPC for atomic token consumption
*/

-- 1. Ensure telegram_chat_id is strictly unique
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS unique_telegram_chat_id;
ALTER TABLE profiles 
  ADD CONSTRAINT unique_telegram_chat_id UNIQUE (telegram_chat_id);

-- 2. Create idempotency table
CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
    update_id bigint PRIMARY KEY,
    created_at timestamptz DEFAULT now()
);

-- Note: No RLS needed for telegram_webhook_updates as it's only used by the service role in the webhook.
ALTER TABLE telegram_webhook_updates ENABLE ROW LEVEL SECURITY;

-- 3. Create RPC for atomic linking
-- This function atomically checks the token, marks it used, and updates the profile.
-- It returns the user_id if successful, or raises an error if the token is invalid/used.
CREATE OR REPLACE FUNCTION link_telegram_account(p_token text, p_chat_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_expires_at timestamptz;
    v_used boolean;
BEGIN
    -- Select the token WITH (UPDLOCK) to prevent concurrent modifications
    SELECT user_id, expires_at, used 
    INTO v_user_id, v_expires_at, v_used
    FROM telegram_link_tokens
    WHERE token = p_token
    FOR UPDATE;

    -- 1. Token exists?
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_TOKEN';
    END IF;

    -- 2. Token used?
    IF v_used THEN
        RAISE EXCEPTION 'USED_TOKEN';
    END IF;

    -- 3. Token expired?
    IF v_expires_at < now() THEN
        RAISE EXCEPTION 'EXPIRED_TOKEN';
    END IF;

    -- 4. Mark token as used
    UPDATE telegram_link_tokens
    SET used = true
    WHERE token = p_token;

    -- 5. Update profile
    -- Using INSERT ... ON CONFLICT or a simple UPDATE.
    -- Assuming profile already exists (created on user signup).
    UPDATE profiles
    SET telegram_chat_id = p_chat_id
    WHERE user_id = v_user_id;

    -- Check if profile was actually updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    -- Return the linked user_id
    RETURN v_user_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'CHAT_ID_ALREADY_LINKED';
END;
$$;
