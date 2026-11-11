import { useState } from 'react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { cn } from '../../lib/utils';
import { useCanHover } from '../../hooks/useCanHover';
import { services, type Service } from '../../data/site';

/** Stage of the journey each service belongs to (2 · 3 · 2 · 2). */
const phases = ['Plan', 'Plan', 'Apply', 'Apply', 'Apply', 'Go', 'Go', 'Thrive', 'Thrive'];

function Summary({ s, i }: { s: Service; i: number }) {
  const Icon = s.icon;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/20 transition-colors duration-500 group-data-[open=true]:bg-gold-500 group-data-[open=true]:text-navy-950">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-right">
          <span className="block font-display text-3xl leading-none text-white/20 transition group-data-[open=true]:text-gold-400/60">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-400/80">{phases[i]}</span>
        </span>
      </div>
      <h3 className="mt-6 font-sans text-lg font-semibold leading-snug text-white">{s.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-navy-200">{s.description}</p>
    </>
  );
}

function Details({ s }: { s: Service }) {
  return (
    <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-4">
      {s.details.map((d) => (
        <li key={d} className="flex gap-2.5 text-sm leading-snug text-navy-100">
          <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden />
          {d}
        </li>
      ))}
    </ul>
  );
}

const cardBase = 'rounded-2xl border p-7';

export function Services() {
  const canHover = useCanHover();
  const [active, setActive] = useState<number | null>(null);

  return (
    // Only the background is clipped, so an opened card in the bottom row can still reach past the section's edge.
    <section id="services" className="relative scroll-mt-24 bg-navy-950 py-24 sm:py-32">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-gold-500/10 blur-3xl" />
      </div>
      <Container className="relative">
        <SectionHeading
          light
          eyebrow="Our services"
          title={<>Nine services. <span className="italic text-gold-400">One seamless journey.</span></>}
          description="All free. All connected. Tracked in your portal."
        />

        {/* Nine cards in an even 3 × 3 grid (one column on phones). */}
        <ol className="mt-16 grid gap-5 md:grid-cols-3">
          {services.map((s, i) => {
            // Touch screens: a plain card with its details always shown.
            if (!canHover) {
              return (
                <li key={s.code}>
                  <Reveal delay={(i % 3) * 90} className="h-full">
                    <div className={cn(cardBase, 'group h-full border-white/10 bg-white/[0.04]')}>
                      <Summary s={s} i={i} />
                      <Details s={s} />
                    </div>
                  </Reveal>
                </li>
              );
            }

            // Mouse: the card keeps its place in the grid (held by an invisible copy of the summary). The visible card
            // sits on top of that place and, when opened, grows downwards over the cards below without moving them.
            const open = active === i;
            const dimmed = active !== null && !open;
            return (
              <li key={s.code} className={cn('relative', open && 'z-20')}>
                <Reveal delay={(i % 3) * 90} className="h-full">
                  <div className="relative h-full">
                    <div className={cn(cardBase, 'invisible h-full border-transparent')} aria-hidden>
                      <Summary s={s} i={i} />
                    </div>
                    <div
                      tabIndex={0}
                      data-open={open}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      className={cn(
                        cardBase,
                        'group absolute inset-x-0 top-0 min-h-full overflow-hidden outline-none transition-all duration-500 ease-out',
                        open
                          ? 'border-gold-500/40 bg-navy-800 shadow-2xl shadow-black/50 ring-1 ring-gold-500/20'
                          : 'border-white/10 bg-navy-900',
                        dimmed && 'scale-[0.98] opacity-40 blur-[2px]',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-gold-400 to-gold-600 transition-transform duration-500',
                          open ? 'scale-x-100' : 'scale-x-0',
                        )}
                        aria-hidden
                      />
                      <Summary s={s} i={i} />
                      {/* Details: height animates from 0 to their natural size. Still read by screen readers when closed. */}
                      <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                        <div className={cn('min-h-0 overflow-hidden transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')}>
                          <Details s={s} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
