import { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  FolderClosed,
  Plus,
  Upload,
  Star,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  Edit2,
  X,
  Loader2,
  Eye,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, formatBytes, formatRelative, getFileIcon, getFileExtension } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { DocumentCard } from '@/components/DocumentCard';

// Configure pdfjs worker for thumbnail generation on upload
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentsProps {
  onQuickAdd: () => void;
}

export function Documents({ onQuickAdd: _onQuickAdd }: DocumentsProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMeta, setFileMeta] = useState({ name: '', category: 'other', description: '' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  
  // Pagination & Layout State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const PAGE_SIZE = 20;

  const loadData = async (pageNum = 0, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    if (pageNum === 0) {
      const foldersRes = await supabase.from('folders').select('*').order('name');
      setFolders(foldersRes.data ?? []);
    }

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase.from('files')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setFiles(prev => append ? [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { loadData(0, false); }, []);

  const handleLoadMore = () => {
    loadData(page + 1, true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setFileMeta({ name: file.name, category: 'other', description: '' });
    setShowFileModal(true);
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

  const handleUpload = async () => {
    if (!pendingFile || !user) return;
    setUploading(true);
    setUploadProgress(10);
    
    const ext = pendingFile.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2);
    const basePath = `${user.id}/${timestamp}-${randomStr}`;
    const path = `${basePath}.${ext}`;

    // 1. Generate thumbnail if applicable
    let thumbnailPath = null;
    const thumbBlob = await generateThumbBlob(pendingFile);
    if (thumbBlob) {
      thumbnailPath = `${basePath}_thumb.jpg`;
      await supabase.storage.from(STORAGE_BUCKET).upload(thumbnailPath, thumbBlob);
    }
    
    setUploadProgress(40);

    // 2. Upload actual file
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, pendingFile);

    if (uploadError) {
      setUploading(false);
      alert('Upload failed: ' + uploadError.message);
      return;
    }
    
    setUploadProgress(80);

    // 3. Insert record & Optimistically update UI
    const { data: newRow, error } = await supabase.from('files').insert({
      name: fileMeta.name,
      storage_path: path,
      file_type: ext?.toUpperCase() ?? null,
      mime_type: pendingFile.type,
      size_bytes: pendingFile.size,
      category: fileMeta.category,
      description: fileMeta.description || null,
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
      setFiles(prev => [newRow, ...prev]);
    }

    await supabase.from('activity_logs').insert({ action: 'Document uploaded', item_type: 'file', details: fileMeta.name });

    setUploading(false);
    setUploadProgress(100);
    setTimeout(() => {
        setPendingFile(null);
        setShowFileModal(false);
        setUploadProgress(0);
        setFileMeta({ name: '', category: 'other', description: '' });
    }, 500);
  };

  const toggleFavorite = async (file: any) => {
    const newFav = !file.favorite;
    setFiles(files.map(f => f.id === file.id ? { ...f, favorite: newFav } : f));
    const { error } = await supabase.from('files').update({ favorite: newFav }).eq('id', file.id as string);
    if (error) {
      alert('Failed to update favorite status');
      setFiles(files);
    }
  };

  const deleteFile = async (file: any) => {
    if (!confirm('Delete this file?')) return;
    setFiles(files.filter(f => f.id !== file.id)); // Optimistic delete
    
    const { error } = await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('id', file.id as string);
    if (error) {
      alert('Failed to delete file: ' + error.message);
      setFiles(files);
      return;
    }

    if (file.storage_path) {
      const pathsToRemove = [file.storage_path as string];
      if (file.metadata?.thumbnail_path) pathsToRemove.push(file.metadata.thumbnail_path);
      await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
    }
    
    await supabase.from('activity_logs').insert({ action: 'Document deleted', item_type: 'file', details: file.name as string });
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
    await supabase.from('activity_logs').insert({ action: 'Document downloaded', item_type: 'file', details: file.name as string });
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    await supabase.from('folders').insert({ name: folderName.trim() });
    setFolderName('');
    setShowFolderModal(false);
    loadData(0, false);
  };

  const filteredFiles = filter === 'favorites' ? files.filter((f) => f.favorite) : files;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Documents</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{files.length} files in your vault</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFolderModal(true)}>
            <Plus className="h-4 w-4" /> Folder
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" />
        </div>
      </div>

      {/* Filter and Layout tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'favorites'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition capitalize',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700'
              )}
            >
              {f === 'favorites' ? 'Starred' : 'All'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-1 bg-ink-100 dark:bg-ink-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-lg transition', viewMode === 'grid' ? 'bg-white dark:bg-ink-900 text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-1.5 rounded-lg transition', viewMode === 'list' ? 'bg-white dark:bg-ink-900 text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300')}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">Folders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {folders.map((folder) => (
              <div key={folder.id as string} className="flex items-center gap-3 p-4 rounded-2xl card hover:shadow-md transition cursor-pointer">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600">
                  <FolderClosed className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200 truncate">{folder.name as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {loading ? (
        <div className={cn("grid gap-4", viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className={cn("rounded-2xl", viewMode === 'grid' ? "h-64" : "h-16")} />)}
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          icon={<FolderClosed className="h-9 w-9" />}
          title="No documents yet"
          description="Upload your important documents once and find them instantly when you need them."
          action={<Button onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload Document</Button>}
        />
      ) : (
        <div className="space-y-6">
          <div className={cn("grid gap-5", viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 gap-3")}>
            {filteredFiles.map((file) => (
              <DocumentCard
                key={file.id as string}
                file={file}
                onView={setPreviewFile}
                onDownload={downloadFile}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteFile}
                layout={viewMode}
              />
            ))}
          </div>
          
          {hasMore && !loading && (
            <div className="flex justify-center pt-4">
              <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</> : 'Load More Documents'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Folder modal */}
      <Modal open={showFolderModal} onClose={() => setShowFolderModal(false)} title="New Folder" size="sm">
        <div className="space-y-4">
          <Input label="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Education" autoFocus />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowFolderModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={createFolder}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Upload modal */}
      <Modal open={showFileModal} onClose={() => { setShowFileModal(false); setPendingFile(null); }} title="Upload Document" size="md">
        <div className="space-y-4">
          {pendingFile && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-100 dark:bg-ink-800">
              <File className="h-8 w-8 text-brand-600" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{pendingFile.name}</div>
                <div className="text-xs text-ink-400">{formatBytes(pendingFile.size)}</div>
              </div>
            </div>
          )}
          {uploading && (
            <div>
              <div className="h-2 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-ink-400 mt-2 text-center">Processing and uploading... {uploadProgress}%</p>
            </div>
          )}
          {!uploading && (
            <>
              <Input label="Name" value={fileMeta.name} onChange={(e) => setFileMeta({ ...fileMeta, name: e.target.value })} />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Category</label>
                <select className="input-field" value={fileMeta.category} onChange={(e) => setFileMeta({ ...fileMeta, category: e.target.value })}>
                  <option value="other">Other</option>
                  <option value="identity">Identity</option>
                  <option value="education">Education</option>
                  <option value="career">Career</option>
                  <option value="finance">Finance</option>
                </select>
              </div>
              <Textarea label="Description (optional)" value={fileMeta.description} onChange={(e) => setFileMeta({ ...fileMeta, description: e.target.value })} rows={2} />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowFileModal(false); setPendingFile(null); }}>Cancel</Button>
                <Button className="flex-1" onClick={handleUpload}><Upload className="h-4 w-4" /> Upload</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
