import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Container } from '../ui/Container';
import { ButtonLink } from '../ui/Button';
import { DemoBadge } from '../ui/DemoBadge';
import { SmartImage } from '../ui/SmartImage';
import { images, stats } from '../../data/site';

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
            From choosing the right course to settling in abroad, AHatIn gives Indian students honest advice, a dedicated
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
            {['No consultancy fees', 'One named counsellor', 'Transparent commission disclosure'].map((t) => (
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
            <div className="relative rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-lift backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Your progress</p>
                <DemoBadge light label="Demo" />
              </div>
              <div className="mt-5 space-y-4">
                {[
                  ['Career counselling', 100],
                  ['University shortlist', 100],
                  ['Applications', 75],
                  ['Scholarships & funding', 50],
                  ['Visa', 0],
                ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-xs text-navy-100">
                      <span>{label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/10 p-4">
                <ShieldCheck className="h-8 w-8 shrink-0 text-gold-300" aria-hidden />
                <p className="text-xs leading-relaxed text-navy-100">
                  <span className="font-semibold text-white">Offer received</span> from a UK university. Next step: accept
                  your offer by the deadline.
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
