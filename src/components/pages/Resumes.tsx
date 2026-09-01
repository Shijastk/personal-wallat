import { useEffect, useState, useRef } from 'react';
import { FileText, Plus, Star, Trash2, CheckCircle2, Circle, Download, Upload, Loader2 } from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, formatDate, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';

export function Resumes() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', target_role: '', version: '', notes: '', file_path: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('resumes').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setResumes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setAttachmentFile(null);
    setForm({ name: '', target_role: '', version: '', notes: '', file_path: '' });
    setShowModal(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setAttachmentFile(null);
    setForm({
      name: r.name as string ?? '',
      target_role: r.target_role as string ?? '',
      version: r.version as string ?? '',
      notes: r.notes as string ?? '',
      file_path: r.file_path as string ?? '',
    });
    setShowModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !user) return;
    
    setUploading(true);
    let finalFilePath = form.file_path;

    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop();
      const path = `${user.id}/resumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, attachmentFile);
      if (!error) {
        finalFilePath = path;
      } else {
        alert('Failed to upload file: ' + error.message);
        setUploading(false);
        return; 
      }
    }

    const payload = { name: form.name, target_role: form.target_role, version: form.version, notes: form.notes, file_path: finalFilePath };
    
    if (editing) {
      const { error } = await supabase.from('resumes').update(payload).eq('id', editing.id as string);
      if (error) { 
        alert('Failed to update resume: ' + error.message); 
        if (attachmentFile && finalFilePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([finalFilePath]);
        }
        setUploading(false);
        return; 
      }
      
      if (attachmentFile && form.file_path && form.file_path !== finalFilePath) {
         await supabase.storage.from(STORAGE_BUCKET).remove([form.file_path]).catch(console.error);
      }
    } else {
      const { error } = await supabase.from('resumes').insert(payload);
      if (error) { 
        alert('Failed to add resume: ' + error.message); 
        if (attachmentFile && finalFilePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([finalFilePath]);
        }
        setUploading(false);
        return; 
      }
      await supabase.from('activity_logs').insert({ action: 'Resume added', item_type: 'resume', details: form.name });
    }
    
    setUploading(false);
    setShowModal(false);
    load();
  };

  const setPrimary = async (r: any) => {
    if (r.is_primary) return;
    const { error: resetError } = await supabase.from('resumes').update({ is_primary: false }).eq('user_id', r.user_id as string);
    if (resetError) { alert('Failed to reset primary status'); return; }
    const { error } = await supabase.from('resumes').update({ is_primary: true }).eq('id', r.id as string);
    if (error) { alert('Failed to set primary resume'); return; }
    load();
  };

  const toggleFav = async (r: any) => {
    setResumes(resumes.map(resume => resume.id === r.id ? { ...resume, favorite: !r.favorite } : resume));
    const { error } = await supabase.from('resumes').update({ favorite: !(r.favorite as boolean) }).eq('id', r.id as string);
    if (error) { 
      alert('Failed to update favorite status'); 
      setResumes(resumes);
    }
  };

  const remove = async (r: any) => {
    if (!confirm('Delete this resume?')) return;
    setResumes(resumes.filter(resume => resume.id !== r.id));
    
    const { error } = await supabase.from('resumes').update({ deleted_at: new Date().toISOString() }).eq('id', r.id as string);
    if (error) { 
      alert('Failed to delete resume: ' + error.message); 
      setResumes(resumes);
      return; 
    }
    
    if (r.file_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([r.file_path as string]).catch(console.error);
    }
  };

  const handleDownload = async (r: any) => {
    if (!r.file_path) return;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(r.file_path as string);
    if (error) {
      alert('Failed to download: ' + error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(r.name as string).replace(/\s+/g, '_')}_resume`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Resumes</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{resumes.length} resume versions</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-9 w-9" />}
          title="No resumes yet"
          description="Store all your resume versions — frontend, backend, freelance, ATS — and find the right one instantly."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Resume</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resumes.map((r) => (
            <div key={r.id as string} className="p-5 rounded-2xl card hover:shadow-md transition">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 shrink-0">
                  <FileText className="h-6 w-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">{r.name as string}</h3>
                  {r.target_role && <p className="text-sm text-ink-500 dark:text-ink-400 truncate">{r.target_role as string}</p>}
                </div>
                <button onClick={() => toggleFav(r)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', r.favorite ? 'text-amber-500' : 'text-ink-400')}>
                  <Star className={cn('h-4 w-4', r.favorite && 'fill-current')} />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                {r.is_primary && <Badge color="purple">Primary</Badge>}
                {r.version && <Badge color="gray">v{r.version as string}</Badge>}
                <span className="text-xs text-ink-400 ml-auto">Updated {formatRelative(r.updated_at as string)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPrimary(r)} className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
                  {r.is_primary ? <CheckCircle2 className="h-4 w-4 text-brand-600" /> : <Circle className="h-4 w-4" />}
                  {r.is_primary ? 'Primary' : 'Set as primary'}
                </button>
                <div className="ml-auto flex items-center gap-1">
                  {r.file_path && (
                    <button onClick={() => handleDownload(r)} title="Download" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(r)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                    <FileText className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(r)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => !uploading && setShowModal(false)} title={editing ? 'Edit Resume' : 'Add Resume'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Frontend Developer Resume" disabled={uploading} />
          
          <div className="bg-ink-50 dark:bg-ink-900 p-4 rounded-xl border border-ink-100 dark:border-ink-800 space-y-3">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Resume File</label>
            <div className="flex items-center gap-3">
               <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-1.5" /> {attachmentFile || form.file_path ? 'Change File' : 'Upload File'}
               </Button>
               <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileSelect} />
               {(attachmentFile || form.file_path) && (
                 <span className="text-sm text-brand-600 flex items-center gap-1 truncate max-w-[200px]">
                   <FileText className="h-4 w-4 shrink-0" /> {attachmentFile ? attachmentFile.name : 'File attached'}
                 </span>
               )}
            </div>
          </div>

          <Input label="Target Role" value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} placeholder="e.g. Senior Frontend Developer" disabled={uploading} />
          <Input label="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.0" disabled={uploading} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} disabled={uploading} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)} disabled={uploading}>Cancel</Button>
            <Button className="flex-1" onClick={save} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : editing ? 'Save' : 'Add Resume'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
