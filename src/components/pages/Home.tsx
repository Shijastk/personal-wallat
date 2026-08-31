import { useEffect, useState } from 'react';
import {
  FolderClosed,
  Award,
  Briefcase,
  FileText,
  KeyRound,
  CreditCard,
  StickyNote,
  User,
  Clock,
  Star,
  AlertCircle,
  Upload,
  Scan,
  Plus,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn, getGreeting, formatRelative, daysUntil } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Feedback';
import type { Route } from '@/components/Layout';

interface HomeProps {
  onNavigate: (route: Route) => void;
  onQuickAdd: () => void;
  onSearch: () => void;
}

interface Counts {
  files: number;
  certificates: number;
  projects: number;
  resumes: number;
  credentials: number;
  cards: number;
  notes: number;
}

interface RecentItem {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  updated_at: string;
  route: Route;
}

interface ExpiringItem {
  id: string;
  title: string;
  expiry_date: string;
  type: string;
  route: Route;
}

const categories: { label: string; icon: React.ReactNode; route: Route; color: string; bg: string }[] = [
  { label: 'Documents', icon: <FolderClosed className="h-5 w-5" />, route: 'documents', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-950/50' },
  { label: 'Certificates', icon: <Award className="h-5 w-5" />, route: 'certificates', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/50' },
  { label: 'Projects', icon: <Briefcase className="h-5 w-5" />, route: 'projects', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
  { label: 'Resumes', icon: <FileText className="h-5 w-5" />, route: 'resumes', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/50' },
  { label: 'Passwords', icon: <KeyRound className="h-5 w-5" />, route: 'passwords', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/50' },
  { label: 'Cards', icon: <CreditCard className="h-5 w-5" />, route: 'cards', color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/50' },
  { label: 'Notes', icon: <StickyNote className="h-5 w-5" />, route: 'notes', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/50' },
  { label: 'Profile', icon: <User className="h-5 w-5" />, route: 'profile', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/50' },
];

const quickActions: { label: string; icon: React.ReactNode; onClick: () => void; bg: string }[] = [
  { label: 'Upload', icon: <Upload className="h-5 w-5" />, onClick: () => {}, bg: 'bg-brand-600' },
  { label: 'Scan', icon: <Scan className="h-5 w-5" />, onClick: () => {}, bg: 'bg-ink-700' },
  { label: 'Password', icon: <KeyRound className="h-5 w-5" />, onClick: () => {}, bg: 'bg-red-600' },
  { label: 'Certificate', icon: <Award className="h-5 w-5" />, onClick: () => {}, bg: 'bg-amber-600' },
  { label: 'Project', icon: <Briefcase className="h-5 w-5" />, onClick: () => {}, bg: 'bg-emerald-600' },
  { label: 'Profile', icon: <Plus className="h-5 w-5" />, onClick: () => {}, bg: 'bg-purple-600' },
];

export function Home({ onNavigate, onQuickAdd, onSearch }: HomeProps) {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [files, certs, projects, resumes, creds, cards, notes] = await Promise.all([
        supabase.from('files').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('certificates').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('resumes').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('credentials').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('cards').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('secure_notes').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      ]);

      setCounts({
        files: files.count ?? 0,
        certificates: certs.count ?? 0,
        projects: projects.count ?? 0,
        resumes: resumes.count ?? 0,
        credentials: creds.count ?? 0,
        cards: cards.count ?? 0,
        notes: notes.count ?? 0,
      });

      const recentFiles = await supabase
        .from('files')
        .select('id, name, category, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      const recentCerts = await supabase
        .from('certificates')
        .select('id, title, issuing_organization, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      const recentProjects = await supabase
        .from('projects')
        .select('id, name, description, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      const recentResumes = await supabase
        .from('resumes')
        .select('id, name, target_role, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      const allRecent: RecentItem[] = [
        ...(recentFiles.data ?? []).map((f: any) => ({ id: f.id as string, title: f.name as string, subtitle: (f.category as string) || 'Document', type: 'file', updated_at: f.updated_at as string, route: 'documents' as Route })),
        ...(recentCerts.data ?? []).map((c: any) => ({ id: c.id as string, title: c.title as string, subtitle: c.issuing_organization as string, type: 'certificate', updated_at: c.updated_at as string, route: 'certificates' as Route })),
        ...(recentProjects.data ?? []).map((p: any) => ({ id: p.id as string, title: p.name as string, subtitle: p.description as string, type: 'project', updated_at: p.updated_at as string, route: 'projects' as Route })),
        ...(recentResumes.data ?? []).map((r: any) => ({ id: r.id as string, title: r.name as string, subtitle: r.target_role as string, type: 'resume', updated_at: r.updated_at as string, route: 'resumes' as Route })),
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);

      setRecent(allRecent);

      const expiringCerts = await supabase
        .from('certificates')
        .select('id, title, expiry_date')
        .not('expiry_date', 'is', null)
        .is('deleted_at', null)
        .order('expiry_date', { ascending: true })
        .limit(5);

      const expiringItems: ExpiringItem[] = (expiringCerts.data ?? [])
        .filter((c: any) => {
          const d = daysUntil(c.expiry_date as string);
          return d !== null && d >= 0 && d <= 90;
        })
        .map((c: any) => ({
          id: c.id as string,
          title: c.title as string,
          expiry_date: c.expiry_date as string,
          type: 'certificate',
          route: 'certificates' as Route,
        }));

      setExpiring(expiringItems);
      setLoading(false);
    })();
  }, []);

  const name = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="animate-slide-up">
        <p className="text-sm text-ink-500 dark:text-ink-400">{getGreeting()},</p>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-ink-100 mt-0.5">{name}</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Your personal vault</p>
      </div>

      {/* Search bar */}
      <button
        onClick={onSearch}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600">
          <span className="text-lg">🔍</span>
        </span>
        <span className="flex-1 text-ink-400 dark:text-ink-500">Search anything...</span>
        <kbd className="hidden sm:inline-flex items-center rounded-md border border-ink-300 dark:border-ink-600 px-1.5 text-xs text-ink-400">
          ⌘K
        </kbd>
      </button>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if (action.label === 'Upload') onNavigate('documents');
                else if (action.label === 'Scan') onNavigate('documents');
                else if (action.label === 'Password') onNavigate('passwords');
                else if (action.label === 'Certificate') onNavigate('certificates');
                else if (action.label === 'Project') onNavigate('projects');
                else if (action.label === 'Profile') onNavigate('profile');
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl card hover:shadow-md transition group"
            >
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm group-hover:scale-110 transition', action.bg)}>
                {action.icon}
              </span>
              <span className="text-xs font-medium text-ink-600 dark:text-ink-300">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vault Overview */}
      <div>
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">Your Vault</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Documents', count: counts?.files ?? 0, icon: <FolderClosed className="h-5 w-5" />, route: 'documents' as Route, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-950/50' },
              { label: 'Certificates', count: counts?.certificates ?? 0, icon: <Award className="h-5 w-5" />, route: 'certificates' as Route, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/50' },
              { label: 'Projects', count: counts?.projects ?? 0, icon: <Briefcase className="h-5 w-5" />, route: 'projects' as Route, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
              { label: 'Resumes', count: counts?.resumes ?? 0, icon: <FileText className="h-5 w-5" />, route: 'resumes' as Route, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/50' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.route)}
                className="flex flex-col items-start gap-3 p-4 rounded-2xl card hover:shadow-md transition text-left"
              >
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', item.bg, item.color)}>
                  {item.icon}
                </span>
                <div>
                  <div className="text-2xl font-bold text-ink-900 dark:text-ink-100">{item.count}</div>
                  <div className="text-xs text-ink-500 dark:text-ink-400">{item.label}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Smart Categories */}
      <div>
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => onNavigate(cat.route)}
              className="flex items-center gap-3 p-3.5 rounded-2xl card hover:shadow-md transition group"
            >
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl group-hover:scale-110 transition', cat.bg, cat.color)}>
                {cat.icon}
              </span>
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent
          </h2>
          <button onClick={() => onNavigate('documents')} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="card p-8 text-center">
            <Star className="h-8 w-8 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-400">No items yet. Start by uploading something important.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => onNavigate(item.route)}
                className="flex items-center gap-3 w-full p-4 rounded-2xl card hover:shadow-md transition text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500">
                  {item.type === 'file' && <FolderClosed className="h-5 w-5" />}
                  {item.type === 'certificate' && <Award className="h-5 w-5" />}
                  {item.type === 'project' && <Briefcase className="h-5 w-5" />}
                  {item.type === 'resume' && <FileText className="h-5 w-5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{item.title}</div>
                  {item.subtitle && <div className="text-xs text-ink-400 truncate">{item.subtitle}</div>}
                </div>
                <span className="text-xs text-ink-400">{formatRelative(item.updated_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expiring Soon */}
      {expiring.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Expiring Soon
          </h2>
          <div className="space-y-2">
            {expiring.map((item) => {
              const d = daysUntil(item.expiry_date);
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.route)}
                  className="flex items-center gap-3 w-full p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 hover:shadow-md transition text-left"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{item.title}</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      Expires in {d} {d === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Security banner */}
      <button
        onClick={() => onNavigate('security')}
        className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/20 hover:shadow-xl transition"
      >
        <Shield className="h-8 w-8" />
        <div className="flex-1 text-left">
          <div className="font-semibold">Security Center</div>
          <div className="text-sm text-brand-100">Check your vault security score and settings</div>
        </div>
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
