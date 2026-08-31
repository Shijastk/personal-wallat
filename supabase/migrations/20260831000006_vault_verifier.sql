/* Vault unlock verifier: stores only client-encrypted verifier ciphertext. */
CREATE TABLE IF NOT EXISTS vault_verifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  verifier_encrypted text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vault_verifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_vault_verifier" ON vault_verifiers;
CREATE POLICY "select_own_vault_verifier" ON vault_verifiers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_vault_verifier" ON vault_verifiers;
CREATE POLICY "insert_own_vault_verifier" ON vault_verifiers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_vault_verifier" ON vault_verifiers;
CREATE POLICY "update_own_vault_verifier" ON vault_verifiers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_vault_verifiers_updated ON vault_verifiers;
CREATE TRIGGER trg_vault_verifiers_updated BEFORE UPDATE ON vault_verifiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
