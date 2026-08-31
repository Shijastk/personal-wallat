import { type ReactNode, useEffect, useState } from 'react';
import {
  Home,
  FolderClosed,
  FolderOpen,
  Search,
  User,
  Plus,
  Shield,
  FileText,
  Award,
  Briefcase,
  KeyRound,
  CreditCard,
  StickyNote,
  Settings,
  Moon,
  Sun,
  Lock,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type Route =
  | 'home'
  | 'vault'
  | 'search'
  | 'profile'
  | 'documents'
  | 'certificates'
  | 'projects'
  | 'resumes'
  | 'passwords'
  | 'cards'
  | 'notes'
  | 'security'
  | 'activity'
  | 'settings';

interface LayoutProps {
  route: Route;
  onNavigate: (route: Route) => void;
  children: ReactNode;
  onQuickAdd: () => void;
  onSearch: () => void;
}

const navItems: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { route: 'vault', label: 'Vault', icon: <FolderClosed className="h-5 w-5" /> },
  { route: 'search', label: 'Search', icon: <Search className="h-5 w-5" /> },
  { route: 'profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
];

const sidebarItems: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { route: 'vault', label: 'Documents', icon: <FolderClosed className="h-5 w-5" /> },
  { route: 'certificates', label: 'Certificates', icon: <Award className="h-5 w-5" /> },
  { route: 'projects', label: 'Projects', icon: <Briefcase className="h-5 w-5" /> },
  { route: 'resumes', label: 'Resumes', icon: <FileText className="h-5 w-5" /> },
  { route: 'passwords', label: 'Passwords', icon: <KeyRound className="h-5 w-5" /> },
  { route: 'cards', label: 'Cards', icon: <CreditCard className="h-5 w-5" /> },
  { route: 'notes', label: 'Secure Notes', icon: <StickyNote className="h-5 w-5" /> },
];

const sidebarFooter: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'security', label: 'Security', icon: <Shield className="h-5 w-5" /> },
  { route: 'activity', label: 'Activity', icon: <FileText className="h-5 w-5" /> },
  { route: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
];

export function Layout({ route, onNavigate, children, onQuickAdd, onSearch }: LayoutProps) {
  const { profile, lock, signOut } = useAuth();
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vault-theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('vault-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('vault-theme', 'light');
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 z-30">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg text-ink-900 dark:text-ink-100">Personal Vault</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {sidebarItems.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition',
                route === item.route
                  ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            System
          </div>
          {sidebarFooter.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition',
                route === item.route
                  ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-ink-200 dark:border-ink-800 space-y-1">
          <button
            onClick={toggleDark}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={lock}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
          >
            <Lock className="h-5 w-5" />
            Lock vault
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
          >
            <User className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-ink-900 shadow-2xl animate-slide-down flex flex-col">
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Shield className="h-5 w-5" />
                </div>
                <span className="font-bold text-lg text-ink-900 dark:text-ink-100">Personal Vault</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
              {[...sidebarItems, ...sidebarFooter].map((item) => (
                <button
                  key={item.route}
                  onClick={() => { onNavigate(item.route); setSidebarOpen(false); }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition',
                    route === item.route
                      ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-ink-200 dark:border-ink-800 space-y-1">
              <button onClick={toggleDark} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                {dark ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={lock} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
                <Lock className="h-5 w-5" /> Lock vault
              </button>
              <button onClick={signOut} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
                <User className="h-5 w-5" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 glass border-b border-ink-200/60 dark:border-ink-800/60">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <FolderOpen className="h-5 w-5" />
              </button>
              <button
                onClick={onSearch}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500 text-sm w-64 sm:w-80 hover:bg-ink-200 dark:hover:bg-ink-700 transition"
              >
                <Search className="h-4 w-4" />
                <span>Search anything...</span>
                <kbd className="ml-auto hidden sm:inline-flex items-center rounded-md border border-ink-300 dark:border-ink-600 px-1.5 text-xs text-ink-400">
                  ⌘K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleDark} className="p-2.5 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition text-ink-600 dark:text-ink-300">
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={() => onNavigate('profile')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-semibold"
              >
                {(profile?.full_name || 'U').charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 sm:px-6 py-6 pb-28 lg:pb-6 max-w-6xl mx-auto animate-fade-in">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-ink-200/60 dark:border-ink-800/60">
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          {navItems.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition',
                route === item.route
                  ? 'text-brand-600'
                  : 'text-ink-400 dark:text-ink-500'
              )}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Floating action button */}
      <button
        onClick={onQuickAdd}
        className="lg:hidden fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95 transition"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
