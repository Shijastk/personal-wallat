import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iqebvgjbfkrrhmdbzvat.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DXGe4ipF3bfVW0Ruvp_2xA_EcosA9Ds';

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function runTests() {
  console.log("--- Starting Tests ---");
  
  // Create Test User A
  const emailA = `test_a_${Date.now()}@example.com`;
  const { data: userA, error: errA } = await supabase.auth.signUp({
    email: emailA,
    password: 'password123'
  });
  if (errA) { console.error("Failed to create User A:", errA); return; }
  console.log("Created User A:", userA.user.id);
  
  // Sign in as User A
  await supabase.auth.signInWithPassword({ email: emailA, password: 'password123' });
  
  console.log("\\n--- TEST 1: PROJECT FILE FROM WEB ---");
  const { data: proj, error: projErr } = await supabase.from('projects').insert({
    name: 'Test Project 1'
  }).select().single();
  
  if (projErr || !proj) { console.error("Test 1 Fail: Project creation error", projErr); return; }
  console.log("Project created:", proj.id);
  
  // Upload a file to storage
  const fileContent = "This is a test PDF content";
  const storagePath = `${userA.user.id}/test_${Date.now()}.pdf`;
  const { error: storageErr } = await supabase.storage.from('vault-files').upload(storagePath, fileContent, { contentType: 'application/pdf' });
  if (storageErr) { console.error("Test 1 Fail: Storage upload error", storageErr); return; }
  console.log("Storage file uploaded:", storagePath);
  
  // Insert file record
  const { data: fileRec, error: fileErr } = await supabase.from('files').insert({
    name: 'test.pdf',
    storage_path: storagePath,
    category: 'projects',
    project_id: proj.id,
    user_id: userA.user.id
  }).select().single();
  
  if (fileErr) { console.error("Test 1 Fail: File record error", fileErr); return; }
  console.log("File record created:", fileRec.id);
  
  if (fileRec.project_id === proj.id && fileRec.user_id === userA.user.id) {
    console.log("Test 1 PASS: File linked correctly to project and user.");
  } else {
    console.error("Test 1 FAIL: Link mismatch");
  }
  
  console.log("\\n--- TEST 6: USER ISOLATION ---");
  // Create Test User B
  const emailB = `test_b_${Date.now()}@example.com`;
  const { data: userB } = await supabase.auth.signUp({ email: emailB, password: 'password123' });
  await supabase.auth.signInWithPassword({ email: emailB, password: 'password123' });
  console.log("Created & Signed in as User B:", userB.user.id);
  
  // Try to access User A's project
  const { data: bProjList } = await supabase.from('projects').select('*').eq('id', proj.id);
  if (bProjList.length === 0) {
    console.log("Test 6 PASS: User B cannot see User A's project.");
  } else {
    console.error("Test 6 FAIL: User B sees User A's project.");
  }
  
  // Try to access User A's files
  const { data: bFileList } = await supabase.from('files').select('*').eq('id', fileRec.id);
  if (bFileList.length === 0) {
    console.log("Test 6 PASS: User B cannot see User A's file.");
  } else {
    console.error("Test 6 FAIL: User B sees User A's file.");
  }
  
  console.log("\\n--- TEST 9: PROJECT DELETE / STORAGE CLEANUP ---");
  // Note: Web app delete logic is in React. To test it we must replicate the exact code from Projects.tsx 
  // Let's replicate Projects.tsx remove() logic for User A
  await supabase.auth.signInWithPassword({ email: emailA, password: 'password123' });
  
  const { data: pFiles } = await supabase.from('files').select('id, storage_path, metadata').eq('project_id', proj.id).is('deleted_at', null);
  console.log("Found files to delete:", pFiles.length);
  
  const pathsToRemove = [];
  pFiles.forEach(f => {
    if (f.storage_path) pathsToRemove.push(f.storage_path);
  });
  
  const { error: rmErr } = await supabase.storage.from('vault-files').remove(pathsToRemove);
  if (!rmErr) console.log("Storage objects removed successfully.");
  else console.error("Failed to remove storage objects", rmErr);
  
  await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('project_id', proj.id);
  await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', proj.id);
  
  // Verify storage is gone
  const { data: dData, error: dErr } = await supabase.storage.from('vault-files').download(storagePath);
  if (dErr && dErr.message.includes("Object not found")) {
    console.log("Test 9 PASS: Storage object confirmed deleted.");
  } else {
    console.error("Test 9 FAIL: Storage object still exists!", dData);
  }
}

runTests().catch(console.error);
