/*
# Fix Telegram Linking RPC (Missing Profiles)

1. Changes
- Update `link_telegram_account` to perform an UPSERT-style operation.
- If a user exists in `auth.users` but does not yet have a `profiles` row,
  the RPC will safely create the profile row with the linked `telegram_chat_id`.
*/

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
    -- 1. Select the token WITH (UPDLOCK) to prevent concurrent modifications
    SELECT user_id, expires_at, used 
    INTO v_user_id, v_expires_at, v_used
    FROM telegram_link_tokens
    WHERE token = p_token
    FOR UPDATE;

    -- 2. Token validation
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_TOKEN';
    END IF;

    IF v_used THEN
        RAISE EXCEPTION 'USED_TOKEN';
    END IF;

    IF v_expires_at < now() THEN
        RAISE EXCEPTION 'EXPIRED_TOKEN';
    END IF;

    -- 3. Mark token as used atomically
    UPDATE telegram_link_tokens
    SET used = true
    WHERE token = p_token;

    -- 4. Update profile or create if missing
    UPDATE profiles
    SET telegram_chat_id = p_chat_id
    WHERE user_id = v_user_id;

    -- If no profile exists for this user_id, create it now
    IF NOT FOUND THEN
        INSERT INTO profiles (user_id, telegram_chat_id)
        VALUES (v_user_id, p_chat_id);
    END IF;

    -- Return the securely linked user_id
    RETURN v_user_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'CHAT_ID_ALREADY_LINKED';
END;
$$;
