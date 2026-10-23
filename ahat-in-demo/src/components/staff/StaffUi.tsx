import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DemoBadge } from '../ui/DemoBadge';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <DemoBadge label="Demo data" />
        <h1 className="mt-3 text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-navy-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  green: 'bg-emerald-50 text-emerald-700',
  navy: 'bg-navy-50 text-navy-700',
};

export function StatCard({ label, value, icon: Icon, tone = 'navy', note }: { label: string; value: ReactNode; icon: LucideIcon; tone?: keyof typeof tones; note?: string }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-navy-500">{label}</p>
        <p className="font-display text-3xl text-navy-900">{value}</p>
        {note && <p className="mt-0.5 text-xs text-navy-400">{note}</p>}
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:max-w-xs">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input py-2.5 pl-10" type="search" />
    </label>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
            value === o.value ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Seven small segments showing a student's progress through AHatIn's services. */
export function ServiceBar({ values, names }: { values: number[]; names: string[] }) {
  return (
    <div className="flex gap-1" aria-label={`Services: ${values.filter((v) => v === 2).length} of 7 completed`} role="img">
      {values.map((v, i) => (
        <span
          key={i}
          title={`${names[i]}: ${v === 2 ? 'Completed' : v === 1 ? 'In progress' : 'Not started'}`}
          className={cn('h-1.5 flex-1 rounded-full', v === 2 ? 'bg-emerald-500' : v === 1 ? 'bg-sky-400' : 'bg-navy-100')}
        />
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white p-8 text-center text-sm text-navy-500 ring-1 ring-navy-100">{children}</p>;
}
