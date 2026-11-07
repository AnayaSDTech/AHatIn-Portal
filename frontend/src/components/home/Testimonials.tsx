import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { testimonials } from '../../data/site';
import { cn } from '../../lib/utils';

export function Testimonials() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = testimonials.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % count), 7000);
    return () => clearInterval(t);
  }, [paused, count]);

  // Load every photo once, so the next story doesn't flash while its photo downloads.
  useEffect(() => {
    testimonials.forEach((t) => {
      new Image().src = t.image;
    });
  }, []);

  const go = (dir: number) => setActive((a) => (a + dir + count) % count);
  const current = testimonials[active]!;

  return (
    <section id="stories" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Student success stories"
          title={<>Real journeys, <span className="italic text-gold-600">remarkable outcomes</span></>}
        />
        <Reveal className="mx-auto mt-14 max-w-4xl">
          <div
            className="relative rounded-[2rem] bg-navy-950 p-8 text-white shadow-lift sm:p-14"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <Quote className="absolute right-8 top-8 h-20 w-20 text-white/5" aria-hidden />
            <blockquote key={active} className="animate-fade-up font-display text-xl leading-relaxed sm:text-2xl" aria-live="polite">
              “{current.quote}”
            </blockquote>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img
                  key={current.image}
                  src={current.image}
                  alt={current.name}
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 animate-fade-up rounded-full object-cover ring-2 ring-gold-500"
                />
                <div>
                  <p className="font-semibold">{current.name}</p>
                  <p className="text-sm text-navy-200">{current.university}</p>
                  {current.course && <p className="text-xs text-navy-300">{current.course}</p>}
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
