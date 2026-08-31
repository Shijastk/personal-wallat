import { useState } from 'react';
import { Shield, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-ink-50 to-white dark:from-ink-950 dark:to-ink-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10 animate-fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Personal Vault</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
            Everything important about you. One secure place.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            icon={<Mail className="h-5 w-5" />}
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'signup' ? 'Create a strong master password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock className="h-5 w-5" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[42px] text-ink-400 hover:text-ink-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <p className="text-xs text-ink-400">
              Your master password encrypts sensitive data with AES-256. Choose wisely — it cannot be recovered.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
          {mode === 'signin' ? (
            <>
              New to Personal Vault?{' '}
              <button
                onClick={() => { setMode('signup'); setError(null); }}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); setError(null); }}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
