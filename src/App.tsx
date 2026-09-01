import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route as RouterRoute, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Layout } from '@/components/Layout';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { LockScreen } from '@/components/auth/LockScreen';
import { Home } from '@/components/pages/Home';
import { Documents } from '@/components/pages/Documents';
import { Certificates } from '@/components/pages/Certificates';
import { Projects } from '@/components/pages/Projects';
import { Resumes } from '@/components/pages/Resumes';
import { Passwords } from '@/components/pages/Passwords';
import { Cards } from '@/components/pages/Cards';
import { Notes } from '@/components/pages/Notes';
import { Profile } from '@/components/pages/Profile';
import { Security } from '@/components/pages/Security';
import { ActivityPage } from '@/components/pages/Activity';
import { SettingsPage } from '@/components/pages/Settings';
import { QuickAddModal } from '@/components/QuickAddModal';
import { SearchPalette, routeForType } from '@/components/SearchPalette';
import { Loader2 } from 'lucide-react';

function VaultApp() {
  const { user, loading, locked } = useAuth();
  const navigate = useNavigate();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(false);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-sm text-ink-400">Loading your vault...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (locked) {
    return <LockScreen />;
  }

  return (
    <>
      <Layout
        onQuickAdd={() => setQuickAddOpen(true)}
        onSearch={() => setSearchOpen(true)}
      >
        <Routes>
          <RouterRoute path="/" element={<Home onQuickAdd={() => setQuickAddOpen(true)} onSearch={() => setSearchOpen(true)} />} />
          <RouterRoute path="/documents" element={<Documents onQuickAdd={() => setQuickAddOpen(true)} />} />
          <RouterRoute path="/vault" element={<Navigate to="/documents" replace />} />
          <RouterRoute path="/certificates" element={<Certificates />} />
          <RouterRoute path="/projects" element={<Projects />} />
          <RouterRoute path="/resumes" element={<Resumes />} />
          <RouterRoute path="/passwords" element={<Passwords />} />
          <RouterRoute path="/cards" element={<Cards />} />
          <RouterRoute path="/notes" element={<Notes />} />
          <RouterRoute path="/profile" element={<Profile />} />
          <RouterRoute path="/security" element={<Security />} />
          <RouterRoute path="/activity" element={<ActivityPage />} />
          <RouterRoute path="/settings" element={<SettingsPage dark={dark} toggleDark={toggleDark} />} />
          <RouterRoute path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onUpload={() => navigate('/documents')}
      />
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onResultClick={(result) => {
          const r = routeForType[result.type];
          if (r) navigate(r);
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <VaultApp />
      </BrowserRouter>
    </AuthProvider>
  );
}
