import { useState, useEffect } from 'react';
import { Moon, Sun, Lock, LogOut, Shield, Database, Info, MessageSquare, Copy, Check, ExternalLink, CheckCircle2, Unlink, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface SettingsProps {
  dark: boolean;
  toggleDark: () => void;
}

function generateTelegramToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function SettingsPage({ dark, toggleDark }: SettingsProps) {
  const { lock, signOut, user, profile, refreshProfile } = useAuth();
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'YourVaultBot';
  const isLinked = !!profile?.telegram_chat_id;

  useEffect(() => {
    if (isLinked) setTelegramToken(null);
  }, [isLinked]);

  const handleCopy = () => {
    if (!telegramToken) return;
    navigator.clipboard.writeText(`/start ${telegramToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGenerateToken = async () => {
    if (!user) return;
    setTelegramLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: existing } = await supabase
        .from('telegram_link_tokens').select('token').eq('user_id', user.id).eq('status', 'ACTIVE').limit(1);
      if (existing && existing.length > 0) {
        setTelegramToken(existing[0].token);
        return;
      }

      const token = generateTelegramToken();
      const distantFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('telegram_link_tokens').insert({
        user_id: user.id, token, expires_at: distantFuture, status: 'ACTIVE'
      });
      if (!error) setTelegramToken(token);
      else alert('Failed to generate link token. Make sure migrations are applied.');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!user || !confirm('Regenerate token? The old token will be revoked, but your existing Telegram connection will remain active.')) return;
    setTelegramLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('telegram_link_tokens').update({ status: 'REVOKED', used: true })
        .eq('user_id', user.id).eq('status', 'ACTIVE');
      const token = generateTelegramToken();
      const distantFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('telegram_link_tokens').insert({
        user_id: user.id, token, expires_at: distantFuture, status: 'ACTIVE'
      });
      if (!error) setTelegramToken(token);
      else alert('Failed to regenerate link token.');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!user || !confirm('Disconnect your Telegram account from this vault?')) return;
    setTelegramLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('profiles').update({ telegram_chat_id: null }).eq('user_id', user.id);
      await supabase.from('telegram_link_tokens').update({ status: 'REVOKED', used: true }).eq('user_id', user.id);
      await refreshProfile();
      setTelegramToken(null);
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Settings</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Manage your vault preferences</p>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-4">Appearance</h2>
        <button onClick={toggleDark} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</span>
          <div className="flex-1 text-left"><div className="text-sm font-medium text-ink-900 dark:text-ink-100">{dark ? 'Light mode' : 'Dark mode'}</div><div className="text-xs text-ink-400">Toggle theme appearance</div></div>
        </button>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-4">Security</h2>
        <div className="space-y-1">
          <button onClick={lock} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600"><Lock className="h-5 w-5" /></span>
            <div className="flex-1 text-left"><div className="text-sm font-medium text-ink-900 dark:text-ink-100">Lock vault now</div><div className="text-xs text-ink-400">Require master password to unlock</div></div>
          </button>
          <div className="flex items-center gap-3 w-full p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"><Shield className="h-5 w-5" /></span><div className="flex-1"><div className="text-sm font-medium text-ink-900 dark:text-ink-100">AES-256-GCM encryption</div><div className="text-xs text-ink-400">Sensitive data encrypted client-side</div></div></div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-4">Integrations</h2>
        <div className="space-y-1">
          {isLinked ? (
            <div className="flex flex-col gap-3 w-full p-3 rounded-xl">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span><div className="flex-1"><div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Telegram Connected</div><div className="text-xs text-ink-400">Your vault is linked to your Telegram account</div></div></div>
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" size="sm" onClick={handleRegenerateToken} disabled={telegramLoading} className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30">{telegramLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔄 Regenerate Token'}</Button>
                <Button variant="outline" size="sm" onClick={handleUnlink} disabled={telegramLoading} className="shrink-0 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">{telegramLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlink className="h-4 w-4 mr-1" />Disconnect</>}</Button>
              </div>
              {telegramToken && <TokenPanel token={telegramToken} botUsername={TELEGRAM_BOT_USERNAME} copied={copied} onCopy={handleCopy} />}
            </div>
          ) : (
            <>
              <button onClick={handleGenerateToken} disabled={telegramLoading} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition disabled:opacity-60 disabled:cursor-not-allowed">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">{telegramLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}</span>
                <div className="flex-1 text-left"><div className="text-sm font-medium text-blue-600 dark:text-blue-500">Connect Telegram Bot</div><div className="text-xs text-ink-400">Send files and notes securely via Telegram</div></div>
              </button>
              {telegramToken && <TokenPanel token={telegramToken} botUsername={TELEGRAM_BOT_USERNAME} copied={copied} onCopy={handleCopy} />}
            </>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-4">Account</h2>
        <div className="space-y-1">
          <div className="flex items-center gap-3 p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500"><Info className="h-5 w-5" /></span><div className="flex-1"><div className="text-sm font-medium text-ink-900 dark:text-ink-100">Email</div><div className="text-xs text-ink-400">{user?.email ?? 'Unknown'}</div></div></div>
          <button onClick={signOut} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600"><LogOut className="h-5 w-5" /></span><div className="flex-1 text-left"><div className="text-sm font-medium text-red-600">Sign out</div><div className="text-xs text-ink-400">Sign out of Personal Vault</div></div></button>
        </div>
      </div>
    </div>
  );
}

function TokenPanel({ token, botUsername, copied, onCopy }: { token: string; botUsername: string; copied: boolean; onCopy: () => void }) {
  return <div className="mt-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50">
    <div className="text-sm text-blue-800 dark:text-blue-300 mb-3">Your token has been generated. Send this command to your Vault Bot on Telegram:</div>
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-white dark:bg-ink-950 p-2 rounded-lg text-sm font-mono text-center border border-ink-100 dark:border-ink-800 text-ink-900 dark:text-ink-100 select-all overflow-x-auto">/start {token}</code>
      <Button variant="outline" size="icon" onClick={onCopy} className="shrink-0 h-10 w-10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 bg-white dark:bg-ink-950" title="Copy /start command">{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</Button>
      <a href={`https://t.me/${botUsername}?start=${token}`} target="_blank" rel="noreferrer" title="Open bot in Telegram" className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 bg-white dark:bg-ink-950 transition"><ExternalLink className="h-4 w-4" /></a>
    </div>
    {copied && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">✓ Copied! Paste it in your Telegram bot chat.</p>}
  </div>;
}
