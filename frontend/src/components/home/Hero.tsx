import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Container } from '../ui/Container';
import { ButtonLink } from '../ui/Button';
import { DemoBadge } from '../ui/DemoBadge';
import { SmartImage } from '../ui/SmartImage';
import { images, stats } from '../../data/site';
import { cn } from '../../lib/utils';

/**
 * Demo journey shown in the hero card (a preview of the student portal). The stages don't all fit, so the
 * steps between funding and the last one are shown as a row of dots ("gap").
 */
const heroSteps: { title: string; note: string; state: 'done' | 'now' | 'next' | 'gap' }[] = [
  { title: 'Counselling & university selection', note: 'Data Science, UK · 4 universities shortlisted', state: 'done' },
  { title: 'Applications', note: '3 submitted · 1 offer received', state: 'now' },
  { title: 'Scholarships & funding', note: '1 scholarship applied', state: 'now' },
  { title: '2 more steps', note: 'Visa · Pre-departure', state: 'gap' },
  { title: 'Post-arrival support', note: 'Settling in after you land', state: 'next' },
];

function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg">{value}%</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 pb-16 pt-32 sm:pt-40 lg:pb-24">
      {/* Background photo with a deep navy wash */}
      <SmartImage
        src={images.hero}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full"
        loading="eager"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-900/60" aria-hidden />
      <div className="absolute -left-40 top-20 -z-10 h-[28rem] w-[28rem] rounded-full bg-gold-500/15 blur-3xl" aria-hidden />

      <Container className="grid items-center gap-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gold-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Free guidance · UK · Europe
          </span>
          <h1 className="mt-6 animate-fade-up text-4xl font-semibold leading-[1.1] text-white [animation-delay:100ms] sm:text-5xl lg:text-6xl">
            Your journey to a world-class university,{' '}
            <span className="italic text-gold-400">guided every step</span> of the way.
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-navy-100 [animation-delay:200ms]">
            From choosing the right course to settling in abroad, AHat gives Indian students honest advice, a dedicated
            counsellor and a portal that shows exactly what happens next.
          </p>
          <div className="mt-9 flex animate-fade-up flex-col gap-3 [animation-delay:300ms] sm:flex-row">
            <ButtonLink to="/register" variant="gold" size="lg">
              Start your free assessment
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/#enquire" variant="light" size="lg">
              Request a call back
            </ButtonLink>
          </div>
          <ul className="mt-8 flex animate-fade-up flex-wrap gap-x-6 gap-y-2 text-sm text-navy-200 [animation-delay:400ms]">
            {['No consultancy fees', 'Dedicated counsellor', 'Transparent and honest advice'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gold-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Floating progress card: a taste of the student portal */}
        <div className="hidden lg:col-span-5 lg:block">
          <div className="relative mx-auto max-w-sm animate-float">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-gold-400/30 to-transparent blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-navy-950/55 text-white shadow-lift backdrop-blur-xl">
              {/* Header: who and how far */}
              <div className="relative flex items-center gap-4 border-b border-white/10 p-5">
                <ProgressRing value={43} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gold-300">Your journey</p>
                  <p className="mt-1 font-semibold leading-snug">MSc Data Science</p>
                  <p className="text-xs text-navy-200">United Kingdom · Sept 2027 intake</p>
                </div>
                <span className="absolute right-4 top-4">
                  <DemoBadge light label="Demo" />
                </span>
              </div>

              {/* Steps, like the student portal */}
              <ol className="space-y-0 px-5 pt-4">
                {heroSteps.map((s, i) =>
                  s.state === 'gap' ? (
                    // The steps in between, as a dotted continuation of the line.
                    <li key={s.title} className="relative flex items-center gap-3 pb-3.5" data-hero-gap>
                      <span className="relative z-10 flex h-6 w-6 shrink-0 flex-col items-center justify-center gap-[3px]" aria-hidden>
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                      </span>
                      <p className="text-xs text-navy-300">
                        <span className="font-medium text-navy-200">{s.title}</span> · {s.note}
                      </p>
                    </li>
                  ) : (
                  <li key={s.title} className="relative flex gap-3 pb-3.5 last:pb-0">
                    {i < heroSteps.length - 1 && heroSteps[i + 1]!.state !== 'gap' && (
                      <span className={cn('absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px', s.state === 'done' ? 'bg-emerald-400/60' : 'bg-white/15')} aria-hidden />
                    )}
                    <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                      {s.state === 'done' ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden />
                      ) : s.state === 'now' ? (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-400/20 ring-1 ring-gold-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" />
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded-full border border-white/25" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm font-medium', s.state === 'next' ? 'text-navy-300' : 'text-white')}>{s.title}</p>
                        {s.state === 'now' && <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">In progress</span>}
                      </div>
                      <p className="text-xs text-navy-300">{s.note}</p>
                    </div>
                  </li>
                  ),
                )}
              </ol>

              {/* Next step */}
              <div className="m-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-gold-400/20 to-gold-400/5 p-4 ring-1 ring-gold-400/30">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-400 text-navy-950">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-xs leading-relaxed text-navy-100">
                  <span className="block font-semibold text-white">Next: reply to your offer</span>
                  University of Manchester · by 23 Nov
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Stats */}
      <Container className="mt-16 lg:mt-24">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-navy-950/40 px-6 py-6 text-center">
              <p className="font-display text-3xl font-semibold text-white sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-navy-200">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-navy-300">Figures shown are demo content.</p>
      </Container>
    </section>
  );
}
