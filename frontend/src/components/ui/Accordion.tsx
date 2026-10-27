import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-soft">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;
        return (
          <div key={item.q}>
            <h3 className="font-sans">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-base font-semibold text-navy-900 transition hover:text-gold-700"
              >
                {item.q}
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-navy-100 transition-all duration-300',
                    isOpen && 'rotate-45 border-gold-500 bg-gold-500 text-navy-950',
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn('grid transition-all duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 leading-relaxed text-navy-600">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
