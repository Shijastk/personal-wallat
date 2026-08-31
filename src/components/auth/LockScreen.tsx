import { useState } from 'react';
import { Shield, Lock, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LockScreen() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    unlock(password);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-ink-50 to-white dark:from-ink-950 dark:to-ink-900 animate-fade-in">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-xl shadow-brand-600/20 animate-scale-in">
          <Lock className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 mb-1">Vault Locked</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-8 text-center">
          Enter your master password to unlock your vault.
        </p>

        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              icon={<Lock className="h-5 w-5" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[15px] text-ink-400 hover:text-ink-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Unlock Vault'}
          </Button>
        </form>

        <button className="mt-4 flex items-center gap-2 text-sm text-ink-500 hover:text-brand-600 transition">
          <Fingerprint className="h-5 w-5" />
          Unlock with biometric
        </button>

        <div className="mt-10 flex items-center gap-2 text-xs text-ink-400">
          <Shield className="h-4 w-4" />
          AES-256-GCM encrypted
        </div>
      </div>
    </div>
  );
}
