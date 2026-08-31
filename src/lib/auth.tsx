import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setSessionKey, clearSessionKey, hasSessionKey } from '@/lib/crypto';
import type { Profile } from '@/lib/types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  locked: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  lock: () => void;
  unlock: (masterPassword: string) => { error: string | null };
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const LOCK_TIMEOUT = 5 * 60 * 1000;
const LOCK_KEY = 'vault-lock-state';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    let lockTimer: ReturnType<typeof setTimeout> | null = null;

    const resetLockTimer = () => {
      if (lockTimer) clearTimeout(lockTimer);
      if (user && hasSessionKey()) {
        lockTimer = setTimeout(() => {
          clearSessionKey();
          setLocked(true);
          sessionStorage.setItem(LOCK_KEY, '1');
        }, LOCK_TIMEOUT);
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetLockTimer, { passive: true }));
    resetLockTimer();

    return () => {
      if (lockTimer) clearTimeout(lockTimer);
      events.forEach((e) => window.removeEventListener(e, resetLockTimer));
    };
  }, [user]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadProfile(sess.user.id);
          const wasLocked = sessionStorage.getItem(LOCK_KEY) === '1';
          if (wasLocked) setLocked(true);
        } else {
          setProfile(null);
          setLocked(false);
          sessionStorage.removeItem(LOCK_KEY);
        }
        setLoading(false);
      })();
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadProfile(sess.user.id);
          const wasLocked = sessionStorage.getItem(LOCK_KEY) === '1';
          if (wasLocked) setLocked(true);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    clearSessionKey();
    sessionStorage.removeItem(LOCK_KEY);
    setLocked(false);
    await supabase.auth.signOut();
  };

  const lock = () => {
    clearSessionKey();
    setLocked(true);
    sessionStorage.setItem(LOCK_KEY, '1');
  };

  const unlock = (masterPassword: string) => {
    setSessionKey(masterPassword);
    setLocked(false);
    sessionStorage.removeItem(LOCK_KEY);
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, locked, signUp, signIn, signOut, lock, unlock, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
