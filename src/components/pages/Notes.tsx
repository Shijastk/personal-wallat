import { useEffect, useState } from 'react';
import { StickyNote, Plus, Star, Trash2, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, formatRelative } from '@/lib/utils';
import { hasSessionKey, encryptWithSession, decryptWithSession } from '@/lib/crypto';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';

export function Notes() {
  const { unlock } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(hasSessionKey());
  const [masterPassword, setMasterPassword] = useState('');
  const [form, setForm] = useState({ title: '', content: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('secure_notes').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setNotes(data ?? []);
    // decrypt all
    const decrypted: Record<string, string> = {};
    for (const n of data ?? []) {
      try { decrypted[n.id as string] = await decryptWithSession(n.content_encrypted as string); } catch { /* skip */ }
    }
    setDecryptedContent(decrypted);
    setLoading(false);
  };

  useEffect(() => { if (vaultUnlocked) load(); }, [vaultUnlocked]);

  const [unlockError, setUnlockError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    
    // Verify password if notes exist
    const { data } = await supabase.from('secure_notes').select('content_encrypted').is('deleted_at', null).limit(1);
    if (data && data.length > 0) {
      try {
        // Temporarily set key to test decryption
        const { setSessionKey, clearSessionKey } = await import('@/lib/crypto');
        setSessionKey(masterPassword);
        await decryptWithSession(data[0].content_encrypted as string);
      } catch (err) {
        setUnlockError('Incorrect master password. Please try again.');
        const { clearSessionKey } = await import('@/lib/crypto');
        clearSessionKey();
        return;
      }
    }

    unlock(masterPassword);
    setVaultUnlocked(true);
    setMasterPassword('');
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', content: '' });
    setShowModal(true);
  };

  const openEdit = (n: any) => {
    setEditing(n);
    setForm({ title: n.title as string, content: decryptedContent[n.id as string] ?? '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const encrypted = await encryptWithSession(form.content);
    if (editing) {
      await supabase.from('secure_notes').update({ title: form.title, content_encrypted: encrypted }).eq('id', editing.id as string);
    } else {
      await supabase.from('secure_notes').insert({ title: form.title, content_encrypted: encrypted });
      await supabase.from('activity_logs').insert({ action: 'Secure note added', item_type: 'note', details: form.title });
    }
    setShowModal(false);
    load();
  };

  const toggleFav = async (n: any) => {
    await supabase.from('secure_notes').update({ favorite: !(n.favorite as boolean) }).eq('id', n.id as string);
    load();
  };

  const remove = async (n: any) => {
    if (!confirm('Delete this note?')) return;
    await supabase.from('secure_notes').update({ deleted_at: new Date().toISOString() }).eq('id', n.id as string);
    load();
  };

  if (!vaultUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 dark:bg-orange-950/50 text-orange-600">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 mb-1">Sensitive Area</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-8 text-center max-w-xs">
          Secure notes are encrypted. Enter your master password to access them.
        </p>
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
          <Input type="password" placeholder="Master password" value={masterPassword} onChange={(e) => { setMasterPassword(e.target.value); setUnlockError(''); }} required icon={<Lock className="h-5 w-5" />} />
          {unlockError && <p className="text-sm text-red-500 text-center">{unlockError}</p>}
          <Button type="submit" className="w-full"><Unlock className="h-4 w-4" /> Unlock Notes</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Secure Notes</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{notes.length} encrypted notes</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="h-9 w-9" />}
          title="No notes yet"
          description="Store important account info, recovery codes, and personal notes — all encrypted."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Note</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map((n) => (
            <div key={n.id as string} className="p-5 rounded-2xl card hover:shadow-md transition">
              <div className="flex items-start gap-3 mb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 shrink-0">
                  <StickyNote className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">{n.title as string}</h3>
                  <p className="text-xs text-ink-400">{formatRelative(n.updated_at as string)}</p>
                </div>
                <button onClick={() => toggleFav(n)} className={cn('p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition', n.favorite ? 'text-amber-500' : 'text-ink-400')}>
                  <Star className={cn('h-4 w-4', n.favorite && 'fill-current')} />
                </button>
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300 line-clamp-3 whitespace-pre-wrap mb-3">
                {decryptedContent[n.id as string] ?? 'Encrypted'}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(n)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                  <StickyNote className="h-4 w-4" />
                </button>
                <button onClick={() => remove(n)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Note' : 'Add Note'} size="md">
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Recovery Codes, Emergency Info" />
          <Textarea label="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} placeholder="Write your note here..." />
          <p className="text-xs text-ink-400">Content is encrypted with AES-256-GCM before storage.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{editing ? 'Save' : 'Add Note'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
