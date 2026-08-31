import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setSessionKey, clearSessionKey, hasSessionKey, encryptWithSession, decryptWithSession } from '@/lib/crypto';
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
  unlock: (masterPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const LOCK_TIMEOUT = 5 * 60 * 1000;
const LOCK_KEY = 'vault-lock-state';
const VERIFIER_MARKER = 'personal-vault-unlock-verifier-v1';

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
      if (user && hasSessionKey() && !locked) {
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
  }, [user, locked]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        clearSessionKey();
        if (sess?.user) {
          await loadProfile(sess.user.id);
          setLocked(true);
          sessionStorage.setItem(LOCK_KEY, '1');
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
        clearSessionKey();
        if (sess?.user) {
          await loadProfile(sess.user.id);
          setLocked(true);
          sessionStorage.setItem(LOCK_KEY, '1');
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

  const unlock = async (masterPassword: string) => {
    if (!masterPassword) return { error: 'Master password is required.' };
    if (!user) return { error: 'You must be signed in.' };
    try {
      const { data: verifier, error: verifierError } = await supabase
        .from('vault_verifiers').select('verifier_encrypted').eq('user_id', user.id).maybeSingle();
      if (verifierError) return { error: 'Unable to verify vault password. Please try again.' };

      if (verifier?.verifier_encrypted) {
        setSessionKey(masterPassword);
        try {
          await decryptWithSession(verifier.verifier_encrypted);
        } catch {
          clearSessionKey();
          return { error: 'Incorrect master password.' };
        }
      } else {
        // Legacy compatibility: never create a verifier from an arbitrary password
        // when encrypted vault data already exists. First validate against ciphertext.
        const [cardsRes, credentialsRes, notesRes] = await Promise.all([
          supabase.from('cards').select('number_encrypted, cvv_encrypted').is('deleted_at', null).limit(1),
          supabase.from('credentials').select('password_encrypted, totp_secret_encrypted, recovery_info_encrypted').is('deleted_at', null).limit(1),
          supabase.from('secure_notes').select('content_encrypted').is('deleted_at', null).limit(1),
        ]);
        if (cardsRes.error || credentialsRes.error || notesRes.error) {
          return { error: 'Unable to verify existing vault data. Please try again.' };
        }

        const legacyCipher =
          cardsRes.data?.[0]?.number_encrypted ||
          cardsRes.data?.[0]?.cvv_encrypted ||
          credentialsRes.data?.[0]?.password_encrypted ||
          credentialsRes.data?.[0]?.totp_secret_encrypted ||
          credentialsRes.data?.[0]?.recovery_info_encrypted ||
          notesRes.data?.[0]?.content_encrypted;

        setSessionKey(masterPassword);
        if (legacyCipher) {
          try {
            await decryptWithSession(legacyCipher);
          } catch {
            clearSessionKey();
            return { error: 'Incorrect master password.' };
          }
        }

        // Only a verified legacy password, or a first unlock of an empty vault,
        // may establish the verifier.
        const verifierEncrypted = await encryptWithSession(VERIFIER_MARKER);
        const { error: insertError } = await supabase.from('vault_verifiers').insert({
          user_id: user.id,
          verifier_encrypted: verifierEncrypted,
        });
        if (insertError && insertError.code !== '23505') {
          clearSessionKey();
          return { error: 'Unable to initialize vault security. Please try again.' };
        }
        if (insertError?.code === '23505') {
          const { data: existing } = await supabase.from('vault_verifiers')
            .select('verifier_encrypted').eq('user_id', user.id).maybeSingle();
          if (!existing?.verifier_encrypted) {
            clearSessionKey();
            return { error: 'Unable to initialize vault security. Please try again.' };
          }
          try {
            await decryptWithSession(existing.verifier_encrypted);
          } catch {
            clearSessionKey();
            return { error: 'Incorrect master password.' };
          }
        }
      }
      setLocked(false);
      sessionStorage.removeItem(LOCK_KEY);
      return { error: null };
    } catch {
      clearSessionKey();
      return { error: 'Unable to unlock vault. Please try again.' };
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, locked, signUp, signIn, signOut, lock, unlock, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
