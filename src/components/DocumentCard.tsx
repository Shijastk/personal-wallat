import { useEffect, useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  FileIcon, 
  Download, 
  Trash2, 
  Star, 
  Eye 
} from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { cn, formatBytes, formatRelative, getFileExtension } from '@/lib/utils';

interface DocumentCardProps {
  file: any;
  onView: (file: any) => void;
  onDownload: (file: any) => void;
  onToggleFavorite: (file: any) => void;
  onDelete: (file: any) => void;
  layout?: 'grid' | 'list';
}

export function DocumentCard({ file, onView, onDownload, onToggleFavorite, onDelete, layout = 'grid' }: DocumentCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const mimeType = (file.mime_type || '').toLowerCase();
  const isImage = mimeType.startsWith('image/');
  const isOffice = mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType.includes('officedocument');

  useEffect(() => {
    let isActive = true;

    const fetchThumbnail = async () => {
      // If there is a generated thumbnail in metadata, use it. Otherwise, if it's an image, load the image itself.
      const targetPath = file.metadata?.thumbnail_path || (isImage ? file.storage_path : null);
      if (!targetPath) {
        if (isActive) setThumbnailUrl(null);
        return;
      }

      try {
        const { data } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(targetPath, 3600); // 1 hour

        if (data?.signedUrl && isActive) {
          setThumbnailUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load thumbnail url:', err);
      }
    };

    fetchThumbnail();
    
    return () => { isActive = false; };
  }, [file.storage_path, file.metadata?.thumbnail_path, isImage]);

  if (layout === 'list') {
    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-ink-900 rounded-xl shadow-sm border border-ink-200 dark:border-ink-800 hover:shadow-md transition group">
        <div 
          className="relative h-12 w-12 rounded-lg bg-ink-50 dark:bg-ink-950 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer border border-ink-100 dark:border-ink-800"
          onClick={() => onView(file)}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-brand-600 dark:text-brand-500 opacity-70">
              {isOffice ? <FileText className="h-6 w-6" /> : <FileIcon className="h-6 w-6" />}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(file)}>
          <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate" title={file.name}>
            {file.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            <span className="uppercase font-medium">{getFileExtension(file.name)}</span>
            <span>•</span>
            <span>{formatBytes(file.size_bytes || 0)}</span>
            <span>•</span>
            <span>{formatRelative(file.updated_at)}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleFavorite(file)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', file.favorite ? 'text-amber-500' : 'text-ink-400')} title="Star">
            <Star className={cn('h-4 w-4', file.favorite && 'fill-current')} />
          </button>
          <button onClick={() => onDownload(file)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition" title="Download">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(file)} className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view (Cards)
  return (
    <div className="flex flex-col bg-white dark:bg-ink-900 rounded-2xl shadow-sm border border-ink-200 dark:border-ink-800 overflow-hidden hover:shadow-md transition group">
      <div 
        className="relative h-48 bg-ink-50 dark:bg-ink-950 flex items-center justify-center overflow-hidden cursor-pointer border-b border-ink-100 dark:border-ink-800"
        onClick={() => onView(file)}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-brand-600 dark:text-brand-500 opacity-70">
            {isOffice ? <FileText className="h-16 w-16" /> : <FileIcon className="h-16 w-16" />}
            <span className="mt-3 text-xs font-bold uppercase tracking-widest bg-brand-100 dark:bg-brand-900/50 px-2 py-1 rounded text-brand-700 dark:text-brand-300">
              {getFileExtension(file.name)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/10 dark:group-hover:bg-white/5 transition flex items-center justify-center opacity-0 group-hover:opacity-100 z-20">
          <div className="bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-4 py-2 rounded-full text-xs font-semibold shadow-sm flex items-center gap-1.5 transform scale-95 group-hover:scale-100 transition-transform">
            <Eye className="h-4 w-4" /> View Document
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate" title={file.name}>
              {file.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-ink-500 dark:text-ink-400">
              <span className="uppercase font-medium">{getFileExtension(file.name)}</span>
              <span>•</span>
              <span>{formatBytes(file.size_bytes || 0)}</span>
            </div>
            <div className="text-xs text-ink-400 mt-0.5">
              Added {formatRelative(file.updated_at)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-ink-100 dark:border-ink-800/50">
          <button onClick={() => onView(file)} className="flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition">
            <Eye className="h-4 w-4" /> View
          </button>
          <button onClick={() => onDownload(file)} className="flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg transition ml-1">
            <Download className="h-4 w-4" /> Save as
          </button>
          <div className="flex items-center gap-1 pl-2 ml-2 border-l border-ink-200 dark:border-ink-700">
             <button onClick={() => onToggleFavorite(file)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', file.favorite ? 'text-amber-500' : 'text-ink-400')} title={file.favorite ? "Unstar" : "Star"}>
                <Star className={cn('h-4 w-4', file.favorite && 'fill-current')} />
              </button>
              <button onClick={() => onDelete(file)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
