import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';

interface DocumentPreviewModalProps {
  file: any | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ file, onClose }: DocumentPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.storage_path) {
      setUrl(null);
      return;
    }

    const fetchUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(file.storage_path as string, 3600); // 1 hour

        if (signedError) {
          throw signedError;
        }

        setUrl(data.signedUrl);
      } catch (err: any) {
        setError(err.message || 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [file]);

  if (!file) return null;

  const mimeType = (file.mime_type || '').toLowerCase();
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isOffice = 
    mimeType.includes('word') || 
    mimeType.includes('excel') || 
    mimeType.includes('powerpoint') ||
    mimeType.includes('officedocument');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-white dark:bg-ink-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/50">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 line-clamp-1">{file.name}</h3>
            {file.category && file.category !== 'other' && (
              <span className="text-xs text-ink-500 capitalize">{file.category}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-ink-100 dark:bg-ink-950 min-h-[300px]">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-ink-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm">Loading preview...</p>
            </div>
          )}
          
          {error && (
            <div className="text-center p-6 text-red-500">
              <p>{error}</p>
              <p className="text-sm text-ink-500 mt-2">Try downloading the file instead.</p>
            </div>
          )}

          {!loading && !error && url && (
            <>
              {isImage && (
                <img 
                  src={url} 
                  alt={file.name} 
                  className="max-w-full max-h-[calc(90vh-4rem)] object-contain" 
                />
              )}
              
              {isPdf && (
                <iframe 
                  src={`${url}#toolbar=0`} 
                  className="w-full h-[calc(90vh-4rem)] border-0 bg-white"
                  title={file.name}
                />
              )}
              
              {isOffice && (
                <iframe 
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} 
                  className="w-full h-[calc(90vh-4rem)] border-0 bg-white"
                  title={file.name}
                />
              )}
              
              {!isImage && !isPdf && !isOffice && (
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto bg-ink-200 dark:bg-ink-800 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-xl text-ink-400 font-bold uppercase">{file.file_type || 'FILE'}</span>
                  </div>
                  <h4 className="text-lg font-medium text-ink-900 dark:text-ink-100 mb-2">No preview available</h4>
                  <p className="text-sm text-ink-500">Previews are not supported for this file type. Please download to view.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
