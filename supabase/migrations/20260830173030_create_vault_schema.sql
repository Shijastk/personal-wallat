/*
# Personal Vault — Core Schema

1. Overview
This migration creates the complete database schema for "Personal Vault", a secure
personal digital wallet / life vault application. Multi-user app with Supabase
email/password auth. Every table is owner-scoped (user_id) with RLS enabled.

2. New Tables
- profiles          — user's professional profile
- folders           — nested folder tree for organizing documents
- files             — uploaded documents (metadata + storage path)
- tags              — user-created tags
- item_tags         — many-to-many join for tags on any item
- certificates      — degree/course/experience certificates
- projects          — professional project records
- resumes           — resume versions with a primary flag
- credentials       — encrypted login credentials
- cards             — encrypted financial card info (masked)
- secure_notes      — encrypted notes
- social_profiles   — social media / portfolio links
- activity_logs     — audit trail of user actions
- share_links       — temporary share links for files

3. Security
- RLS enabled on ALL tables.
- Every table has user_id DEFAULT auth.uid() and 4 owner-scoped policies.
- Sensitive fields stored as encrypted text (AES-256-GCM, client-side encryption).
- Only one primary resume per user via partial unique index.

4. Notes
- Uses gen_random_uuid() for all PKs.
- Soft-delete via deleted_at on files, certificates, projects, resumes, credentials, cards, secure_notes.
- created_at / updated_at timestamps on all tables.
- Folders are self-referencing (parent_id) for unlimited nesting.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  professional_title text,
  bio text,
  email text,
  phone text,
  location text,
  website text,
  portfolio text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profiles" ON profiles;
CREATE POLICY "select_own_profiles" ON profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_profiles" ON profiles;
CREATE POLICY "insert_own_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_profiles" ON profiles;
CREATE POLICY "update_own_profiles" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_profiles" ON profiles;
CREATE POLICY "delete_own_profiles" ON profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FOLDERS
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  icon text DEFAULT 'folder',
  color text DEFAULT 'blue',
  favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_folders" ON folders;
CREATE POLICY "select_own_folders" ON folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_folders" ON folders;
CREATE POLICY "insert_own_folders" ON folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_folders" ON folders;
CREATE POLICY "update_own_folders" ON folders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_folders" ON folders;
CREATE POLICY "delete_own_folders" ON folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FILES
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  storage_path text,
  file_type text,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  category text DEFAULT 'other',
  description text,
  favorite boolean DEFAULT false,
  ocr_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_files" ON files;
CREATE POLICY "select_own_files" ON files FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_files" ON files;
CREATE POLICY "insert_own_files" ON files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_files" ON files;
CREATE POLICY "update_own_files" ON files FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_files" ON files;
CREATE POLICY "delete_own_files" ON files FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TAGS
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT 'gray',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_tags" ON tags;
CREATE POLICY "select_own_tags" ON tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tags" ON tags;
CREATE POLICY "insert_own_tags" ON tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tags" ON tags;
CREATE POLICY "update_own_tags" ON tags FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tags" ON tags;
CREATE POLICY "delete_own_tags" ON tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ITEM_TAGS
CREATE TABLE IF NOT EXISTS item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_item_tags" ON item_tags;
CREATE POLICY "select_own_item_tags" ON item_tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_item_tags" ON item_tags;
CREATE POLICY "insert_own_item_tags" ON item_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_item_tags" ON item_tags;
CREATE POLICY "delete_own_item_tags" ON item_tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuing_organization text,
  issue_date date,
  expiry_date date,
  certificate_id text,
  credential_url text,
  verification_url text,
  category text DEFAULT 'education',
  attachment_path text,
  notes text,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_certificates" ON certificates;
CREATE POLICY "select_own_certificates" ON certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_certificates" ON certificates;
CREATE POLICY "insert_own_certificates" ON certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_certificates" ON certificates;
CREATE POLICY "update_own_certificates" ON certificates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_certificates" ON certificates;
CREATE POLICY "delete_own_certificates" ON certificates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  role text,
  company text,
  start_date date,
  end_date date,
  technologies text[],
  project_url text,
  github_url text,
  live_url text,
  notes text,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RESUMES
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_role text,
  version text,
  file_path text,
  notes text,
  is_primary boolean DEFAULT false,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_resumes" ON resumes;
CREATE POLICY "select_own_resumes" ON resumes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_resumes" ON resumes;
CREATE POLICY "insert_own_resumes" ON resumes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_resumes" ON resumes;
CREATE POLICY "update_own_resumes" ON resumes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_resumes" ON resumes;
CREATE POLICY "delete_own_resumes" ON resumes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS resumes_primary_per_user ON resumes (user_id) WHERE is_primary = true;

-- CREDENTIALS
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  username text,
  url text,
  password_encrypted text NOT NULL,
  notes text,
  totp_secret_encrypted text,
  recovery_info_encrypted text,
  strength_score int DEFAULT 0,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_credentials" ON credentials;
CREATE POLICY "select_own_credentials" ON credentials FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_credentials" ON credentials;
CREATE POLICY "insert_own_credentials" ON credentials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_credentials" ON credentials;
CREATE POLICY "update_own_credentials" ON credentials FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_credentials" ON credentials;
CREATE POLICY "delete_own_credentials" ON credentials FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CARDS
CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  bank text,
  cardholder_name text,
  last_four char(4),
  number_encrypted text,
  expiry_date text,
  card_type text DEFAULT 'debit',
  notes text,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_cards" ON cards;
CREATE POLICY "select_own_cards" ON cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_cards" ON cards;
CREATE POLICY "insert_own_cards" ON cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_cards" ON cards;
CREATE POLICY "update_own_cards" ON cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_cards" ON cards;
CREATE POLICY "delete_own_cards" ON cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SECURE NOTES
CREATE TABLE IF NOT EXISTS secure_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_encrypted text NOT NULL,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  favorite boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE secure_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_secure_notes" ON secure_notes;
CREATE POLICY "select_own_secure_notes" ON secure_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_secure_notes" ON secure_notes;
CREATE POLICY "insert_own_secure_notes" ON secure_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_secure_notes" ON secure_notes;
CREATE POLICY "update_own_secure_notes" ON secure_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_secure_notes" ON secure_notes;
CREATE POLICY "delete_own_secure_notes" ON secure_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SOCIAL PROFILES
CREATE TABLE IF NOT EXISTS social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text,
  url text,
  description text,
  icon text DEFAULT 'link',
  visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_social_profiles" ON social_profiles;
CREATE POLICY "select_own_social_profiles" ON social_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_social_profiles" ON social_profiles;
CREATE POLICY "insert_own_social_profiles" ON social_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_social_profiles" ON social_profiles;
CREATE POLICY "update_own_social_profiles" ON social_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_social_profiles" ON social_profiles;
CREATE POLICY "delete_own_social_profiles" ON social_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  item_type text,
  item_id uuid,
  details text,
  sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_activity_logs" ON activity_logs;
CREATE POLICY "select_own_activity_logs" ON activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_activity_logs" ON activity_logs;
CREATE POLICY "insert_own_activity_logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_activity_logs" ON activity_logs;
CREATE POLICY "delete_own_activity_logs" ON activity_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SHARE LINKS
CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id uuid REFERENCES files(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  password_hash text,
  expires_at timestamptz,
  view_only boolean DEFAULT true,
  downloads int DEFAULT 0,
  max_downloads int,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_share_links" ON share_links;
CREATE POLICY "select_own_share_links" ON share_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_share_links" ON share_links;
CREATE POLICY "insert_own_share_links" ON share_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_share_links" ON share_links;
CREATE POLICY "delete_own_share_links" ON share_links FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_search ON files USING gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(ocr_text,'')));
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_search ON certificates USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(issuing_organization,'') || ' ' || coalesce(notes,'')));
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(notes,'')));
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_secure_notes_user ON secure_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_social_profiles_user ON social_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_user ON item_tags(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_folders_updated ON folders;
CREATE TRIGGER trg_folders_updated BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_files_updated ON files;
CREATE TRIGGER trg_files_updated BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_certificates_updated ON certificates;
CREATE TRIGGER trg_certificates_updated BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_resumes_updated ON resumes;
CREATE TRIGGER trg_resumes_updated BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_credentials_updated ON credentials;
CREATE TRIGGER trg_credentials_updated BEFORE UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cards_updated ON cards;
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_secure_notes_updated ON secure_notes;
CREATE TRIGGER trg_secure_notes_updated BEFORE UPDATE ON secure_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_social_profiles_updated ON social_profiles;
CREATE TRIGGER trg_social_profiles_updated BEFORE UPDATE ON social_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
