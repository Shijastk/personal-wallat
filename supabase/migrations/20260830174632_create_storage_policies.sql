/*
# Storage bucket policies for vault-files

1. Overview
Creates RLS policies on the storage.objects table so authenticated users
can upload, read, update, and delete files only within their own user
folder path (user_id/...).

2. Security
- SELECT: users can read files in their own folder
- INSERT: users can upload files to their own folder
- UPDATE: users can update files in their own folder
- DELETE: users can delete files in their own folder
*/

-- Allow users to read their own files
DROP POLICY IF EXISTS "Users can read own vault files" ON storage.objects;
CREATE POLICY "Users can read own vault files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload own vault files" ON storage.objects;
CREATE POLICY "Users can upload own vault files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own files
DROP POLICY IF EXISTS "Users can update own vault files" ON storage.objects;
CREATE POLICY "Users can update own vault files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete own vault files" ON storage.objects;
CREATE POLICY "Users can delete own vault files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]);
