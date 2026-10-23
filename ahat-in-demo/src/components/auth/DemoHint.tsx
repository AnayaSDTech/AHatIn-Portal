import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';

/** Amber box for demo-only help (codes shown on screen, demo accounts). Never part of the real portal. */
export function DemoHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden /> {title}
      </p>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}
