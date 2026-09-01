import { useEffect, useState } from 'react';
import { Briefcase, Plus, Star, Trash2, ExternalLink, Github, Link as LinkIcon, Calendar, User, Paperclip, UploadCloud } from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';
import { DocumentCard } from '@/components/DocumentCard';
import { useAuth } from '@/lib/auth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', role: '', company: '', start_date: '', end_date: '',
    technologies: '', project_url: '', github_url: '', live_url: '', notes: '',
  });

  // Files Modal State
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', role: '', company: '', start_date: '', end_date: '', technologies: '', project_url: '', github_url: '', live_url: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name as string ?? '', description: p.description as string ?? '', role: p.role as string ?? '',
      company: p.company as string ?? '', start_date: p.start_date as string ?? '', end_date: p.end_date as string ?? '',
      technologies: (p.technologies as string[])?.join(', ') ?? '', project_url: p.project_url as string ?? '',
      github_url: p.github_url as string ?? '', live_url: p.live_url as string ?? '', notes: p.notes as string ?? '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      technologies: form.technologies.split(',').map((t) => t.trim()).filter(Boolean),
    };
    if (editing) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editing.id as string);
      if (error) { alert('Failed to update project: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('projects').insert(payload);
      if (error) { alert('Failed to add project: ' + error.message); return; }
      await supabase.from('activity_logs').insert({ action: 'Project added', item_type: 'project', details: form.name });
    }
    setShowModal(false);
    load();
  };

  const toggleFav = async (p: any) => {
    setProjects(projects.map(proj => proj.id === p.id ? { ...proj, favorite: !p.favorite } : proj));
    const { error } = await supabase.from('projects').update({ favorite: !(p.favorite as boolean) }).eq('id', p.id as string);
    if (error) { 
      alert('Failed to update favorite status'); 
      setProjects(projects);
    }
  };

  const remove = async (p: any) => {
    if (!confirm('Delete this project?')) return;
    
    // 1. Find associated files
    const { data: files } = await supabase.from('files').select('id, storage_path, metadata').eq('project_id', p.id as string).is('deleted_at', null);
    
    // 2. Soft-delete project FIRST
    const { error: projError } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', p.id as string);
    if (projError) {
      alert('Failed to delete project: ' + projError.message);
      return;
    }

    // 3. Soft-delete associated files
    if (files && files.length > 0) {
      const { error: filesError } = await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('project_id', p.id as string);
      
      // 4. Storage cleanup ONLY if DB delete succeeded
      if (!filesError) {
        const pathsToRemove: string[] = [];
        files.forEach((f) => {
          if (f.storage_path) pathsToRemove.push(f.storage_path);
          if (f.metadata?.thumbnail_path) pathsToRemove.push(f.metadata.thumbnail_path);
        });
        if (pathsToRemove.length > 0) {
          await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
        }
      } else {
        alert('Failed to delete associated files: ' + filesError.message);
      }
    }

    load();
  };

  const openFiles = async (p: any) => {
    setActiveProject(p);
    setShowFilesModal(true);
    setLoadingFiles(true);
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', p.id as string)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setProjectFiles(data ?? []);
    setLoadingFiles(false);
  };

  const generateThumbBlob = async (file: File): Promise<Blob | null> => {
    return new Promise(async (resolve) => {
      try {
        if (file.type.startsWith('image/')) {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = Math.min(400 / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
          };
        } else if (file.type === 'application/pdf') {
          const fileUrl = URL.createObjectURL(file);
          const loadingTask = pdfjsLib.getDocument(fileUrl);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const canvas = document.createElement('canvas');
          const scale = 400 / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          const ctx = canvas.getContext('2d');
          if(ctx) {
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
          }
          URL.revokeObjectURL(fileUrl);
        } else {
          resolve(null);
        }
      } catch(e) {
        console.error('Error generating thumbnail:', e);
        resolve(null);
      }
    });
  };

  const handleUploadProjectFile = async () => {
    if (!pendingFile || !user || !activeProject) return;
    setUploading(true);
    
    const ext = pendingFile.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2);
    const basePath = `${user.id}/${timestamp}-${randomStr}`;
    const path = `${basePath}.${ext}`;

    let thumbnailPath = null;
    const thumbBlob = await generateThumbBlob(pendingFile);
    if (thumbBlob) {
      thumbnailPath = `${basePath}_thumb.jpg`;
      await supabase.storage.from(STORAGE_BUCKET).upload(thumbnailPath, thumbBlob);
    }
    
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, pendingFile);

    if (uploadError) {
      setUploading(false);
      alert('Upload failed: ' + uploadError.message);
      return;
    }
    
    const { data: newRow, error } = await supabase.from('files').insert({
      user_id: user.id,
      project_id: activeProject.id,
      name: pendingFile.name,
      storage_path: path,
      file_type: ext?.toUpperCase() ?? null,
      mime_type: pendingFile.type,
      size_bytes: pendingFile.size,
      category: 'projects',
      description: null,
      metadata: thumbnailPath ? { thumbnail_path: thumbnailPath } : {},
    }).select().single();

    if (error) {
      alert('Upload failed during database insertion: ' + error.message);
      setUploading(false);
      const pathsToRemove = [path];
      if (thumbnailPath) pathsToRemove.push(thumbnailPath);
      await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
      return;
    }

    if (newRow) {
      setProjectFiles(prev => [newRow, ...prev]);
    }

    await supabase.from('activity_logs').insert({ action: 'Project file uploaded', item_type: 'file', details: pendingFile.name });

    setUploading(false);
    setPendingFile(null);
  };

  const downloadFile = async (file: any) => {
    if (!file.storage_path) return;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(file.storage_path as string);
    if (error) { alert('Download failed: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = (file.name as string) || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await supabase.from('activity_logs').insert({ action: 'Project file downloaded', item_type: 'file', details: file.name as string });
  };

  const deleteFile = async (file: any) => {
    if (!confirm('Delete this file?')) return;
    setProjectFiles(projectFiles.filter(f => f.id !== file.id)); // Optimistic delete
    
    const { error } = await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('id', file.id as string);
    if (error) {
      alert('Failed to delete file: ' + error.message);
      setProjectFiles(projectFiles);
      return;
    }

    if (file.storage_path) {
      const pathsToRemove = [file.storage_path as string];
      if (file.metadata?.thumbnail_path) pathsToRemove.push(file.metadata.thumbnail_path);
      await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
    }
    
    await supabase.from('activity_logs').insert({ action: 'Project file deleted', item_type: 'file', details: file.name as string });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Projects</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{projects.length} projects</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-9 w-9" />}
          title="No projects yet"
          description="Keep your work history in one place. Add projects to make your professional history searchable."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Project</Button>}
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id as string} className="p-5 rounded-2xl card hover:shadow-md transition">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                  <Briefcase className="h-6 w-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100">{p.name as string}</h3>
                  {p.description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 line-clamp-2">{p.description as string}</p>}
                </div>
                <button onClick={() => toggleFav(p)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', p.favorite ? 'text-amber-500' : 'text-ink-400')}>
                  <Star className={cn('h-4 w-4', p.favorite && 'fill-current')} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500 dark:text-ink-400 mb-3">
                {p.role && <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {p.role as string}</span>}
                {p.company && <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {p.company as string}</span>}
                {p.start_date && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {formatDate(p.start_date as string)}</span>}
              </div>
              {p.technologies && (p.technologies as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(p.technologies as string[]).map((tech) => (
                    <Badge key={tech} color="green">{tech}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {p.live_url && <a href={p.live_url as string} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"><LinkIcon className="h-4 w-4" /> Live</a>}
                {p.github_url && <a href={p.github_url as string} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300 hover:underline"><Github className="h-4 w-4" /> Code</a>}
                {p.project_url && <a href={p.project_url as string} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300 hover:underline"><ExternalLink className="h-4 w-4" /> Project</a>}
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => openFiles(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-50 hover:bg-ink-100 dark:bg-ink-800/50 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300 hover:text-brand-600 transition text-sm font-medium border border-ink-200 dark:border-ink-700/50 mr-1" title="Attach Files">
                    <Paperclip className="h-4 w-4" /> Attach Files
                  </button>
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                    <Briefcase className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(p)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'Add Project'} size="lg">
        <div className="space-y-4">
          <Input label="Project Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Parceler" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What did this project do?" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Frontend Developer" />
            <Input label="Company/Client" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <Input label="Technologies" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} placeholder="React, Next.js, TypeScript (comma-separated)" />
          <Input label="Project URL" value={form.project_url} onChange={(e) => setForm({ ...form, project_url: e.target.value })} placeholder="https://..." />
          <Input label="GitHub URL" value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/..." />
          <Input label="Live URL" value={form.live_url} onChange={(e) => setForm({ ...form, live_url: e.target.value })} placeholder="https://..." />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{editing ? 'Save' : 'Add Project'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showFilesModal} onClose={() => { setShowFilesModal(false); setPendingFile(null); }} title={`Files for ${activeProject?.name}`} size="lg">
        <div className="space-y-6">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
              />
              <Button variant="secondary" className="w-full border border-dashed border-ink-300 dark:border-ink-700 pointer-events-none">
                {pendingFile ? pendingFile.name : 'Choose file...'}
              </Button>
            </div>
            <Button onClick={handleUploadProjectFile} disabled={!pendingFile || uploading} className="shrink-0">
              {uploading ? 'Uploading...' : <><UploadCloud className="h-4 w-4 mr-2" /> Upload</>}
            </Button>
          </div>
          
          <div className="border-t border-ink-200 dark:border-ink-800 pt-4">
            {loadingFiles ? (
               <div className="space-y-3">
                 <Skeleton className="h-20 rounded-xl" />
               </div>
            ) : projectFiles.length === 0 ? (
               <div className="py-8 text-center text-ink-500 dark:text-ink-400">
                 No files attached to this project.
               </div>
            ) : (
               <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                 {projectFiles.map(file => (
                   <DocumentCard 
                     key={file.id} 
                     file={file} 
                     layout="list"
                     onView={downloadFile} 
                     onDownload={downloadFile} 
                     onToggleFavorite={() => {}} 
                     onDelete={deleteFile} 
                   />
                 ))}
               </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
