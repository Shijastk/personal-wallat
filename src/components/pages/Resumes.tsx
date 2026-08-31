import { useEffect, useState } from 'react';
import { FileText, Plus, Star, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatDate, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton, Badge } from '@/components/ui/Feedback';

export function Resumes() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', target_role: '', version: '', notes: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('resumes').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
    setResumes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', target_role: '', version: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      name: r.name as string ?? '',
      target_role: r.target_role as string ?? '',
      version: r.version as string ?? '',
      notes: r.notes as string ?? '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await supabase.from('resumes').update(form).eq('id', editing.id as string);
    } else {
      await supabase.from('resumes').insert(form);
      await supabase.from('activity_logs').insert({ action: 'Resume added', item_type: 'resume', details: form.name });
    }
    setShowModal(false);
    load();
  };

  const setPrimary = async (r: any) => {
    await supabase.from('resumes').update({ is_primary: false }).neq('id', r.id as string);
    await supabase.from('resumes').update({ is_primary: true }).eq('id', r.id as string);
    load();
  };

  const toggleFav = async (r: any) => {
    await supabase.from('resumes').update({ favorite: !(r.favorite as boolean) }).eq('id', r.id as string);
    load();
  };

  const remove = async (r: any) => {
    if (!confirm('Delete this resume?')) return;
    await supabase.from('resumes').update({ deleted_at: new Date().toISOString() }).eq('id', r.id as string);
    load();
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Resume' : 'Add Resume'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Frontend Developer Resume" />
          <Input label="Target Role" value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} placeholder="e.g. Senior Frontend Developer" />
          <Input label="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.0" />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save}>{editing ? 'Save' : 'Add Resume'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
