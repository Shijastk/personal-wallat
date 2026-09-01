import { useEffect, useState, useRef } from 'react';
import { Award, Plus, Star, Trash2, ExternalLink, Calendar, Building2, Hash, Upload, Image as ImageIcon, Loader2, Download, Share2 } from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, formatDate, daysUntil } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';
import { compressImageForAI } from '@/utils/imageCompression';

const categoryColors: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'purple'> = {
  education: 'amber', professional: 'blue', training: 'green', award: 'purple', experience: 'green', other: 'gray',
};

function CertificateCard({ cert, onToggleFav, onEdit, onRemove }: any) {
  const d = daysUntil(cert.expiry_date as string);
  const expiringSoon = d !== null && d >= 0 && d <= 90;
  const expired = d !== null && d < 0;
  
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  
  useEffect(() => {
    let isActive = true;
    if (cert.attachment_path) {
      supabase.storage.from(STORAGE_BUCKET).createSignedUrl(cert.attachment_path, 3600).then(({ data }) => {
        if (data?.signedUrl && isActive) setThumbUrl(data.signedUrl);
      });
    }
    return () => { isActive = false; };
  }, [cert.attachment_path]);

  const handleShare = async () => {
    const urlToShare = cert.credential_url || thumbUrl || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: cert.title,
          text: `Check out my certificate: ${cert.title}`,
          url: urlToShare,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(urlToShare);
      alert('Link copied to clipboard!');
    }
  };

  const handleDownload = async () => {
    if (!cert.attachment_path) return;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(cert.attachment_path);
    if (error) {
      alert('Failed to download: ' + error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(cert.title as string).replace(/\s+/g, '_')}_certificate`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 rounded-2xl card hover:shadow-md transition group flex flex-col h-full">
      <div className="flex items-start gap-3 mb-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 shrink-0 overflow-hidden relative border border-amber-100 dark:border-amber-900">
          {thumbUrl ? (
            <img src={thumbUrl} alt="Certificate" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => window.open(thumbUrl, '_blank')} />
          ) : (
            <Award className="h-6 w-6" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">{cert.title}</h3>
          {cert.issuing_organization && (
            <p className="text-sm text-ink-500 dark:text-ink-400 truncate">{cert.issuing_organization}</p>
          )}
        </div>
        <button onClick={() => onToggleFav(cert)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', cert.favorite ? 'text-amber-500' : 'text-ink-400')}>
          <Star className={cn('h-4 w-4', cert.favorite && 'fill-current')} />
        </button>
      </div>
      <div className="space-y-1.5 text-sm text-ink-500 dark:text-ink-400 flex-1">
        {cert.issue_date && (
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Issued {formatDate(cert.issue_date)}</div>
        )}
        {cert.certificate_id && (
          <div className="flex items-center gap-2"><Hash className="h-4 w-4" /> ID: {cert.certificate_id}</div>
        )}
        {cert.credential_url && (
          <a href={cert.credential_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-600 hover:underline">
            <ExternalLink className="h-4 w-4" /> Credential URL
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-100 dark:border-ink-800/50">
        {cert.category && <Badge color={categoryColors[cert.category] ?? 'gray'}>{cert.category}</Badge>}
        {expiringSoon && <Badge color="amber">Expires in {d} days</Badge>}
        {expired && <Badge color="red">Expired</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {cert.attachment_path && (
            <button onClick={handleDownload} title="Download Image" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
              <Download className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleShare} title="Share" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={() => onEdit(cert)} title="Edit" className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
            <Building2 className="h-4 w-4" />
          </button>
          <button onClick={() => onRemove(cert)} title="Delete" className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Certificates() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  
  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const [form, setForm] = useState({
    title: '', issuing_organization: '', issue_date: '', expiry_date: '',
    certificate_id: '', credential_url: '', verification_url: '', category: 'education', notes: '', attachment_path: ''
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('certificates').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setCerts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setAttachmentFile(null);
    setForm({ title: '', issuing_organization: '', issue_date: '', expiry_date: '', certificate_id: '', credential_url: '', verification_url: '', category: 'education', notes: '', attachment_path: '' });
    setShowModal(true);
  };

  const openEdit = (cert: any) => {
    setEditing(cert);
    setAttachmentFile(null);
    setForm({
      title: cert.title as string ?? '',
      issuing_organization: cert.issuing_organization as string ?? '',
      issue_date: cert.issue_date as string ?? '',
      expiry_date: cert.expiry_date as string ?? '',
      certificate_id: cert.certificate_id as string ?? '',
      credential_url: cert.credential_url as string ?? '',
      verification_url: cert.verification_url as string ?? '',
      category: cert.category as string ?? 'education',
      notes: cert.notes as string ?? '',
      attachment_path: cert.attachment_path as string ?? '',
    });
    setShowModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const handleAutoFill = async () => {
    if (!attachmentFile) return;
    
    setIsExtracting(true);
    try {
      // 1. Compress image client-side to save tokens and bandwidth
      const base64Image = await compressImageForAI(attachmentFile);
      
      // 2. Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('extract-document-data', {
        body: { imageBase64: base64Image, documentType: 'certificate' }
      });

      if (error) {
        console.error("Supabase Edge Function Error Details:", {
          error,
          context: error.context,
          name: error.name,
          message: error.message,
        });
        throw new Error(error.message || 'Edge function error');
      }
      if (!data?.success) {
        console.error("AI Extraction failed but no HTTP error:", data);
        throw new Error(data?.error || 'Failed to extract data');
      }

      const extracted = data.data;
      
      // Helper to prevent "null" strings from AI breaking the DB or date inputs
      const parseString = (val: any) => (val && val !== "null" && val !== "undefined" ? String(val).trim() : "");
      
      // 3. Pre-fill form safely
      setForm(prev => ({
        ...prev,
        title: parseString(extracted.title) || prev.title,
        issuing_organization: parseString(extracted.issuing_organization) || prev.issuing_organization,
        issue_date: parseString(extracted.issue_date) || prev.issue_date,
        expiry_date: parseString(extracted.expiry_date) || prev.expiry_date,
        certificate_id: parseString(extracted.certificate_id) || prev.certificate_id,
        credential_url: parseString(extracted.credential_url) || prev.credential_url
      }));

    } catch (err: any) {
      console.error("AI Extraction Error:", err);
      alert(`AI Auto-fill failed: ${err.message}. You can still fill the form manually.`);
    } finally {
      setIsExtracting(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !user) return;
    
    setUploading(true);
    let finalAttachmentPath = form.attachment_path;

    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop();
      const path = `${user.id}/certificates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, attachmentFile);
      if (!error) {
        finalAttachmentPath = path;
      } else {
        alert('Failed to upload image: ' + error.message);
      }
    }

    const payload: any = { ...form, attachment_path: finalAttachmentPath };
    if (!payload.issue_date) payload.issue_date = null;
    if (!payload.expiry_date) payload.expiry_date = null;

    if (editing) {
      const { error } = await supabase.from('certificates').update(payload).eq('id', editing.id as string);
      if (error) alert('Failed to update: ' + error.message);
    } else {
      const { error } = await supabase.from('certificates').insert(payload);
      if (error) {
        alert('Failed to add certificate: ' + error.message);
      } else {
        await supabase.from('activity_logs').insert({ action: 'Certificate added', item_type: 'certificate', details: form.title });
      }
    }
    
    setUploading(false);
    setShowModal(false);
    load();
  };

  const toggleFav = async (cert: any) => {
    // Optimistic update
    setCerts(certs.map(c => c.id === cert.id ? { ...c, favorite: !c.favorite } : c));
    const { error } = await supabase.from('certificates').update({ favorite: !(cert.favorite as boolean) }).eq('id', cert.id as string);
    if (error) {
      alert('Failed to update favorite status');
      setCerts(certs);
    }
  };

  const remove = async (cert: any) => {
    if (!confirm('Delete this certificate?')) return;
    // Optimistic delete
    setCerts(certs.filter(c => c.id !== cert.id));
    const { error } = await supabase.from('certificates').update({ deleted_at: new Date().toISOString() }).eq('id', cert.id as string);
    if (error) {
      alert('Failed to delete certificate: ' + error.message);
      setCerts(certs);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Certificates</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{certs.length} certificates</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : certs.length === 0 ? (
        <EmptyState
          icon={<Award className="h-9 w-9" />}
          title="No certificates yet"
          description="Your achievements deserve a permanent home. Add your degrees, courses, and certifications."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Certificate</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certs.map((cert) => (
            <CertificateCard 
              key={cert.id} 
              cert={cert} 
              onToggleFav={toggleFav} 
              onEdit={openEdit} 
              onRemove={remove} 
            />
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => !uploading && setShowModal(false)} title={editing ? 'Edit Certificate' : 'Add Certificate'} size="lg">
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Bachelor of Arts" disabled={uploading} />
          
          <div className="bg-ink-50 dark:bg-ink-900 p-4 rounded-xl border border-ink-100 dark:border-ink-800 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Certificate Image / Attachment</label>
              {(attachmentFile || form.attachment_path) && (
                 <Button variant="secondary" size="sm" onClick={handleAutoFill} disabled={uploading || isExtracting || !attachmentFile} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800">
                   {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                   {isExtracting ? 'Extracting...' : 'Auto-Fill with AI'}
                 </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
               <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || isExtracting}>
                  <Upload className="h-4 w-4" /> {attachmentFile || form.attachment_path ? 'Change Image' : 'Upload Image'}
               </Button>
               <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
               {(attachmentFile || form.attachment_path) && (
                 <span className="text-sm text-brand-600 flex items-center gap-1">
                   <ImageIcon className="h-4 w-4" /> {attachmentFile ? attachmentFile.name : 'Image attached'}
                 </span>
               )}
            </div>
          </div>

          <Input label="Issuing Organization" value={form.issuing_organization} onChange={(e) => setForm({ ...form, issuing_organization: e.target.value })} placeholder="e.g. University Name" disabled={uploading} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Issue Date" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} disabled={uploading} />
            <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} disabled={uploading} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Certificate ID" value={form.certificate_id} onChange={(e) => setForm({ ...form, certificate_id: e.target.value })} disabled={uploading} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Category</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={uploading}>
                <option value="education">Education</option>
                <option value="professional">Professional</option>
                <option value="training">Training</option>
                <option value="award">Award</option>
                <option value="experience">Experience</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <Input label="Credential URL" value={form.credential_url} onChange={(e) => setForm({ ...form, credential_url: e.target.value })} placeholder="https://..." disabled={uploading} />
          <Input label="Verification URL" value={form.verification_url} onChange={(e) => setForm({ ...form, verification_url: e.target.value })} placeholder="https://..." disabled={uploading} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} disabled={uploading} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)} disabled={uploading}>Cancel</Button>
            <Button className="flex-1" onClick={save} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : editing ? 'Save' : 'Add Certificate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
