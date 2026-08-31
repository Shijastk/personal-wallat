/*
# Project Files Relationship

1. Changes
- Add `project_id` foreign key to `files` table, referencing `projects(id)` with ON DELETE CASCADE.
- Create index on `files(project_id)` for efficient lookups.
- Add `project_id` to `telegram_intake_sessions` to track selected projects during upload.

2. Security
- Existing RLS policies on `files` naturally apply, as the table itself is already scoped by `user_id`.
*/

ALTER TABLE files ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

ALTER TABLE telegram_intake_sessions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
