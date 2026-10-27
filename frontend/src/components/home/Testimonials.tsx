import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { DemoBadge } from '../ui/DemoBadge';
import { Reveal } from '../ui/Reveal';
import { testimonials } from '../../data/site';
import { cn, initials } from '../../lib/utils';

export function Testimonials() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = testimonials.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % count), 7000);
    return () => clearInterval(t);
  }, [paused, count]);

  const go = (dir: number) => setActive((a) => (a + dir + count) % count);
  const current = testimonials[active]!;

  return (
    <section id="stories" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Student success stories"
          title={<>Real journeys, <span className="italic text-gold-600">remarkable outcomes</span></>}
        />
        <div className="mt-4 flex justify-center">
          <DemoBadge label="Fictional stories for demo" />
        </div>

        <Reveal className="mx-auto mt-14 max-w-4xl">
          <div
            className="relative rounded-[2rem] bg-navy-950 p-8 text-white shadow-lift sm:p-14"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <Quote className="absolute right-8 top-8 h-20 w-20 text-white/5" aria-hidden />
            <div className="flex gap-1 text-gold-400" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" aria-hidden />
              ))}
            </div>
            <blockquote key={active} className="mt-6 animate-fade-up font-display text-xl leading-relaxed sm:text-2xl" aria-live="polite">
              “{current.quote}”
            </blockquote>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500 font-semibold text-navy-950">
                  {initials(current.name)}
                </span>
                <div>
                  <p className="font-semibold">{current.name}</p>
                  <p className="text-sm text-navy-200">
                    From {current.from} · {current.outcome}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 transition hover:border-gold-400 hover:text-gold-400" aria-label="Previous story">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 transition hover:border-gold-400 hover:text-gold-400" aria-label="Next story">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {testimonials.map((t, i) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setActive(i)}
                className={cn('h-2 rounded-full transition-all', i === active ? 'w-8 bg-gold-500' : 'w-2 bg-navy-200 hover:bg-navy-300')}
                aria-label={`Show story ${i + 1}`}
                aria-current={i === active}
              />
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
