import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Panel({
  id,
  title,
  icon,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} tabIndex={-1} className={cn('card scroll-mt-28 p-6 outline-none', className)} aria-label={title}>
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const pillStyles = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  grey: 'bg-navy-50 text-navy-600 ring-navy-100',
  gold: 'bg-gold-50 text-gold-700 ring-gold-200',
};

export function Pill({ tone, children }: { tone: keyof typeof pillStyles; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1', pillStyles[tone])}>
      {children}
    </span>
  );
}
