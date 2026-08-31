/*
# Telegram Integration Migration

1. Changes
- Add `telegram_chat_id` (text) to `profiles` table to link users.
- Create `telegram_link_tokens` table for short-lived, single-use linking tokens.
- Add RLS policies for `telegram_link_tokens`.
*/

-- Add telegram_chat_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles(telegram_chat_id);

-- Create telegram_link_tokens table
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used boolean DEFAULT false
);

ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own tokens
DROP POLICY IF EXISTS "insert_own_tokens" ON telegram_link_tokens;
CREATE POLICY "insert_own_tokens" ON telegram_link_tokens 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Allow users to select their own tokens (useful for frontend state check)
DROP POLICY IF EXISTS "select_own_tokens" ON telegram_link_tokens;
CREATE POLICY "select_own_tokens" ON telegram_link_tokens 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id);

-- Only service role (webhook) will update or read all to link accounts, which bypasses RLS.
