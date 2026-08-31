import { useEffect, useState } from 'react';
import { Activity, Lock, ShieldCheck, FileText, Star, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatRelative } from '@/lib/utils';
import { Skeleton, EmptyState } from '@/components/ui/Feedback';

export function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sensitive'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === 'sensitive' ? logs.filter((l) => l.sensitive) : logs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">Activity Log</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Audit trail of all vault actions</p>
      </div>

      <div className="flex gap-2">
        {(['all', 'sensitive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition capitalize',
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700'
            )}
          >
            {f === 'sensitive' ? 'Sensitive only' : 'All activity'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-9 w-9" />}
          title="No activity yet"
          description="Actions you take in your vault will be logged here for your security audit trail."
        />
      ) : (
        <div className="space-y-1">
          {filtered.map((log) => (
            <div key={log.id as string} className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-900 transition">
              <span className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                log.sensitive ? 'bg-red-50 dark:bg-red-950/50 text-red-600' : 'bg-ink-100 dark:bg-ink-800 text-ink-500',
              )}>
                {log.sensitive ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-700 dark:text-ink-200">{log.action as string}</div>
                {log.details && <div className="text-xs text-ink-400 truncate">{log.details as string}</div>}
              </div>
              <span className="text-xs text-ink-400 shrink-0">{formatRelative(log.created_at as string)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
