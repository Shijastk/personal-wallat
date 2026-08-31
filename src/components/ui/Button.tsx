import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger:
        'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-medium text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50',
    };
    const sizes = {
      sm: 'text-sm px-3 py-2',
      md: '',
      lg: 'text-lg px-6 py-3.5',
    };
    return (
      <button
        ref={ref}
        className={cn(variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
