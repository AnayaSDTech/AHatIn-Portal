import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { services } from '../../data/site';

/** Stage of the journey each service belongs to (2 · 3 · 2). */
const phases = ['Plan', 'Plan', 'Apply', 'Apply', 'Apply', 'Go', 'Go'];

/**
 * Seven cards with no empty gaps: one column on phones, 3 + 2 + 2 on tablets (6-column grid),
 * 4 + 3 on desktops (12-column grid). Class names are written out in full for Tailwind.
 */
const spans = [
  'md:col-span-2 lg:col-span-3',
  'md:col-span-2 lg:col-span-3',
  'md:col-span-2 lg:col-span-3',
  'md:col-span-3 lg:col-span-3',
  'md:col-span-3 lg:col-span-4',
  'md:col-span-3 lg:col-span-4',
  'md:col-span-3 lg:col-span-4',
];

export function Services() {
  return (
    <section id="services" className="relative scroll-mt-24 overflow-hidden bg-navy-950 py-24 sm:py-32">
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" aria-hidden />
      <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
      <Container className="relative">
        <SectionHeading
          light
          eyebrow="Our services"
          title={<>Seven services. <span className="italic text-gold-400">One seamless journey.</span></>}
          description="Every service is free, and each one hands over smoothly to the next. Your portal shows where you are at all times."
        />

        <ol className="mt-16 grid gap-5 md:grid-cols-6 lg:grid-cols-12">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.code} className={spans[i]}>
                <Reveal delay={(i % 4) * 90} className="h-full">
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/40 hover:bg-white/[0.07]">
                    <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-600 transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/20 transition-colors duration-500 group-hover:bg-gold-500 group-hover:text-navy-950">
                        <Icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="text-right">
                        <span className="block font-display text-3xl leading-none text-white/20 transition group-hover:text-gold-400/60">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-400/80">{phases[i]}</span>
                      </span>
                    </div>
                    <h3 className="mt-6 font-sans text-lg font-semibold leading-snug text-white">{s.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-navy-200">{s.description}</p>
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
