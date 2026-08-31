import { useEffect, useState } from 'react';
import {
  KeyRound, Plus, Star, Trash2, Eye, EyeOff, Copy, Check, Lock, Unlock,
  ExternalLink, RefreshCw, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, formatRelative, generatePassword, passwordStrength } from '@/lib/utils';
import { encryptWithSession, decryptWithSession, hasSessionKey } from '@/lib/crypto';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';

export function Passwords() {
  const { locked, unlock } = useAuth();
  const [creds, setCreds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ service: '', username: '', url: '', password: '', notes: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(hasSessionKey());
  const [masterPassword, setMasterPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('credentials').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setCreds(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (vaultUnlocked) load(); }, [vaultUnlocked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    
    // Verify password if credentials exist
    const { data } = await supabase.from('credentials').select('password_encrypted').is('deleted_at', null).limit(1);
    if (data && data.length > 0) {
      try {
        const { setSessionKey, clearSessionKey } = await import('@/lib/crypto');
        setSessionKey(masterPassword);
        await decryptWithSession(data[0].password_encrypted as string);
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
    setForm({ service: '', username: '', url: '', password: '', notes: '' });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ service: c.service as string ?? '', username: c.username as string ?? '', url: c.url as string ?? '', password: '', notes: c.notes as string ?? '' });
    setShowPassword(false);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.service.trim()) return;
    const strength = passwordStrength(form.password);
    if (editing) {
      const updates: any = {
        service: form.service, username: form.username, url: form.url, notes: form.notes,
      };
      if (form.password) {
        updates.password_encrypted = await encryptWithSession(form.password);
        updates.strength_score = strength.score;
      }
      await supabase.from('credentials').update(updates).eq('id', editing.id as string);
    } else {
      const encrypted = await encryptWithSession(form.password);
      await supabase.from('credentials').insert({
        service: form.service, username: form.username, url: form.url,
        password_encrypted: encrypted, notes: form.notes, strength_score: strength.score,
      });
      await supabase.from('activity_logs').insert({ action: 'Password added', item_type: 'credential', details: form.service });
    }
    setShowModal(false);
    load();
  };

  const toggleFav = async (c: any) => {
    await supabase.from('credentials').update({ favorite: !(c.favorite as boolean) }).eq('id', c.id as string);
    load();
  };

  const remove = async (c: any) => {
    if (!confirm('Delete this credential?')) return;
    await supabase.from('credentials').update({ deleted_at: new Date().toISOString() }).eq('id', c.id as string);
    load();
  };

  const reveal = async (c: any) => {
    if (revealed[c.id as string]) {
      setRevealed((prev) => { const next = { ...prev }; delete next[c.id as string]; return next; });
      return;
    }
    try {
      const plain = await decryptWithSession(c.password_encrypted as string);
      setRevealed((prev) => ({ ...prev, [c.id as string]: plain }));
      await supabase.from('activity_logs').insert({ action: 'Password revealed', item_type: 'credential', details: c.service as string, sensitive: true });
    } catch {
      // decryption failed
    }
  };

  const copyPassword = async (c: any, text?: string) => {
    const value = text ?? revealed[c.id as string];
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedId(c.id as string);
    setTimeout(() => setCopiedId(null), 2000);
    await supabase.from('activity_logs').insert({ action: 'Password copied', item_type: 'credential', details: c.service as string, sensitive: true });
  };

  const generate = () => {
    setForm((prev) => ({ ...prev, password: generatePassword(20) }));
    setShowPassword(true);
  };

  const strength = form.password ? passwordStrength(form.password) : null;
  const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];

  if (!vaultUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-950/50 text-red-600">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 mb-1">Sensitive Area</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-8 text-center max-w-xs">
          Passwords are encrypted. Enter your master password to access this section.
        </p>
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
          <Input type="password" placeholder="Master password" value={masterPassword} onChange={(e) => { setMasterPassword(e.target.value); setUnlockError(''); }} required icon={<Lock className="h-5 w-5" />} />
          {unlockError && <p className="text-sm text-red-500 text-center">{unlockError}</p>}
          <Button type="submit" className="w-full"><Unlock className="h-4 w-4" /> Unlock Vault</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Passwords</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{creds.length} credentials, AES-256 encrypted</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : creds.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-9 w-9" />}
          title="No passwords yet"
          description="Securely store your login credentials. Everything is encrypted with AES-256 before it leaves your device."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Password</Button>}
        />
      ) : (
        <div className="space-y-2">
          {creds.map((c) => {
            const score = c.strength_score as number;
            const isRevealed = !!revealed[c.id as string];
            return (
              <div key={c.id as string} className="flex items-center gap-3 p-4 rounded-2xl card hover:shadow-md transition">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 shrink-0 text-lg font-semibold">
                  {(c.service as string).charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ink-900 dark:text-ink-100 truncate">{c.service as string}</h3>
                    <button onClick={() => toggleFav(c)} className={cn('p-0.5', c.favorite ? 'text-amber-500' : 'text-ink-400')}>
                      <Star className={cn('h-3.5 w-3.5', c.favorite && 'fill-current')} />
                    </button>
                  </div>
                  {c.username && <p className="text-xs text-ink-400 truncate">{c.username as string}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono text-ink-600 dark:text-ink-300">
                      {isRevealed ? revealed[c.id as string] : '\u2022'.repeat(12)}
                    </code>
                    <button onClick={() => reveal(c)} className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => copyPassword(c)} className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                      {copiedId === c.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    {c.url && (
                      <a href={c.url as string} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-brand-600 transition">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {score > 0 && (
                    <div className="flex gap-0.5 mr-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={cn('h-1 w-3 rounded-full', n <= score ? strengthColors[score] : 'bg-ink-200 dark:bg-ink-700')} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 transition">
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(c)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Credential' : 'Add Password'} size="md">
        <div className="space-y-4">
          <Input label="Service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="e.g. Google, GitHub, Netflix" />
          <Input label="Username / Email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="you@example.com" />
          <Input label="Login URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? 'Leave blank to keep current' : 'Enter or generate password'}
                  className="input-field pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <Button type="button" variant="secondary" onClick={generate}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {strength && form.password && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className={cn('h-1.5 w-8 rounded-full', n <= strength.score ? strengthColors[strength.score] : 'bg-ink-200 dark:bg-ink-700')} />
                  ))}
                </div>
                <span className="text-xs text-ink-500">{strength.label}</span>
              </div>
            )}
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{editing ? 'Save' : 'Add Password'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
