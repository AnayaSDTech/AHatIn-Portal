import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-navy-900 text-white shadow-soft hover:-translate-y-0.5 hover:bg-navy-800 hover:shadow-lift',
  gold: 'bg-gold-500 text-navy-950 shadow-soft hover:-translate-y-0.5 hover:bg-gold-400 hover:shadow-lift',
  outline: 'border border-navy-200 bg-white/60 text-navy-900 hover:border-navy-900 hover:bg-white',
  ghost: 'text-navy-900 hover:bg-navy-50',
  light: 'border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, loading, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ to, state, variant, size, className, children }: CommonProps & { to: string; state?: unknown }) {
  return (
    <Link to={to} state={state} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
