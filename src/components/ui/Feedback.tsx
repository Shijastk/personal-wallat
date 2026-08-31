import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 dark:bg-brand-950/50 text-brand-500">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-ink-900 dark:text-ink-100 mb-1.5">{title}</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />;
}

interface BadgeProps {
  children: ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'purple';
  className?: string;
}

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  const colors = {
    blue: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    gray: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    purple: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}
