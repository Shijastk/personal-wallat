import { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Award,
  Briefcase,
  KeyRound,
  CreditCard,
  StickyNote,
  Link2,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatRelative } from '@/lib/utils';
import type { SearchResult } from '@/lib/types';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  file: <FileText className="h-5 w-5" />,
  certificate: <Award className="h-5 w-5" />,
  project: <Briefcase className="h-5 w-5" />,
  resume: <FileText className="h-5 w-5" />,
  credential: <KeyRound className="h-5 w-5" />,
  card: <CreditCard className="h-5 w-5" />,
  note: <StickyNote className="h-5 w-5" />,
  social: <Link2 className="h-5 w-5" />,
};

const routeForType: Record<string, string> = {
  file: 'documents',
  certificate: 'certificates',
  project: 'projects',
  resume: 'resumes',
  credential: 'passwords',
  card: 'cards',
  note: 'notes',
  social: 'profile',
};

export function SearchPalette({ open, onClose, onResultClick }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const debounce = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase();
      const allResults: SearchResult[] = [];

      const queries = [
        supabase.from('files').select('id, name, description, category, updated_at').ilike('name', `%${q}%`).limit(5),
        supabase.from('certificates').select('id, title, issuing_organization, updated_at').ilike('title', `%${q}%`).limit(5),
        supabase.from('projects').select('id, name, description, updated_at').ilike('name', `%${q}%`).limit(5),
        supabase.from('resumes').select('id, name, target_role, updated_at').ilike('name', `%${q}%`).limit(5),
        supabase.from('credentials').select('id, service, username, updated_at').ilike('service', `%${q}%`).limit(5),
        supabase.from('cards').select('id, nickname, bank, updated_at').ilike('nickname', `%${q}%`).limit(5),
        supabase.from('secure_notes').select('id, title, updated_at').ilike('title', `%${q}%`).limit(5),
        supabase.from('social_profiles').select('id, platform, username, updated_at').ilike('platform', `%${q}%`).limit(5),
      ];

      const settled = await Promise.all(
        queries.map((q) => Promise.resolve(q).then(({ data }) => data).catch(() => null))
      );

      if (cancelled) return;

      const [files, certs, projects, resumes, creds, cards, notes, socials] = settled;

      (files ?? []).forEach((f: any) =>
        allResults.push({ type: 'file', id: f.id as string, title: f.name as string, subtitle: (f.category as string) || 'Document', icon: 'file' })
      );
      (certs ?? []).forEach((c: any) =>
        allResults.push({ type: 'certificate', id: c.id as string, title: c.title as string, subtitle: c.issuing_organization as string, icon: 'certificate' })
      );
      (projects ?? []).forEach((p: any) =>
        allResults.push({ type: 'project', id: p.id as string, title: p.name as string, subtitle: p.description as string, icon: 'project' })
      );
      (resumes ?? []).forEach((r: any) =>
        allResults.push({ type: 'resume', id: r.id as string, title: r.name as string, subtitle: r.target_role as string, icon: 'resume' })
      );
      (creds ?? []).forEach((c: any) =>
        allResults.push({ type: 'credential', id: c.id as string, title: c.service as string, subtitle: c.username as string, icon: 'credential' })
      );
      (cards ?? []).forEach((c: any) =>
        allResults.push({ type: 'card', id: c.id as string, title: c.nickname as string, subtitle: c.bank as string, icon: 'card' })
      );
      (notes ?? []).forEach((n: any) =>
        allResults.push({ type: 'note', id: n.id as string, title: n.title as string, subtitle: 'Secure note', icon: 'note' })
      );
      (socials ?? []).forEach((s: any) =>
        allResults.push({ type: 'social', id: s.id as string, title: s.platform as string, subtitle: s.username as string, icon: 'social' })
      );

      setResults(allResults);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-ink-900 rounded-2xl shadow-2xl border border-ink-200 dark:border-ink-800 animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-200 dark:border-ink-800">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything..."
            className="flex-1 bg-transparent text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none text-base"
          />
          <kbd className="text-xs text-ink-400 border border-ink-300 dark:border-ink-600 rounded-md px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="py-10 text-center text-sm text-ink-400">
              No results for "{query}"
            </div>
          )}
          {!loading && query.length < 2 && (
            <div className="py-10 text-center text-sm text-ink-400">
              Start typing to search your vault
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    onResultClick(result);
                    onClose();
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 hover:bg-ink-100 dark:hover:bg-ink-800 transition text-left'
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500">
                    {iconMap[result.icon] ?? <FileText className="h-5 w-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-ink-400 truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="text-xs text-ink-400 capitalize">{result.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { routeForType };
