import { useEffect } from 'react';
import { ArrowRight, BadgeCheck, Gift, GraduationCap, Link2, LineChart, Send, UserPlus, UsersRound } from 'lucide-react';
import { Container } from '../components/ui/Container';
import { ButtonLink } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { SectionHeading } from '../components/ui/SectionHeading';

const steps = [
  {
    icon: UserPlus,
    title: 'Create your free account',
    text: 'Open a referrer account in a minute. Already an AHat student? Use "Refer a friend" in your portal instead.',
  },
  {
    icon: Link2,
    title: 'Share your personal link',
    text: 'Copy your link or share it on WhatsApp. You can also invite someone by email straight from your dashboard.',
  },
  {
    icon: Send,
    title: 'They register for free',
    text: 'When they create an account through your link, or with the email you invited, they are added to your list.',
  },
  {
    icon: LineChart,
    title: 'Follow their progress',
    text: 'See how far each person has got, from registration to accepting their university offer.',
  },
];

/** The stages a referred person moves through, as the referrer dashboard shows them. */
const stages = ['Invited', 'Registered', 'Profile complete', 'Applied', 'Offer accepted'];

const audiences = [
  {
    icon: GraduationCap,
    title: 'AHat students',
    text: 'Log in to your portal and open "Refer a friend". Your link and invitations are ready there.',
    cta: { to: '/login', label: 'Student login' },
  },
  {
    icon: UsersRound,
    title: 'Friends, family and alumni',
    text: 'Anyone who knows a future student can refer them. Create a free referrer account to get your link.',
    cta: { to: '/referrer/register', label: 'Become a referrer' },
  },
];

const goodToKnow = [
  'Our guidance is just as free for the people you refer: they pay nothing at any stage.',
  'Please invite only people who are happy to hear from us. If they ignore our email, we won’t contact them again.',
  'Each person can be referred once. If two people invite the same person, the first invitation counts.',
  'People who already have an AHat account can’t be referred.',
  'If someone registers with the email you invited, they are linked to you even without your link.',
];

export function ReferralProgrammePage() {
  useEffect(() => {
    document.title = 'Referral programme · AHat';
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);

  return (
    <article className="pb-24 pt-28 sm:pt-32" data-referral-programme>
      <Container>
        {/* Introduction */}
        <header className="relative overflow-hidden rounded-[2rem] bg-navy-950 px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-navy-500/30 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gold-200">
              <Gift className="h-3.5 w-3.5" aria-hidden />
              Referral programme
            </span>
            <h1 className="mt-6 text-4xl leading-[1.1] text-white sm:text-5xl">
              Know someone who dreams of studying abroad? <span className="italic text-gold-400">Introduce them to AHat.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-100">
              Refer friends and family to free, honest guidance from counsellors who have studied abroad themselves. It takes a minute, and you can follow how far they get.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/referrer/register" variant="gold" size="lg">
                Become a referrer
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/referrer/login" variant="light" size="lg">
                Referrer login
              </ButtonLink>
            </div>
          </div>
        </header>

        {/* How it works */}
        <section className="mt-24" aria-labelledby="how-it-works">
          <SectionHeading eyebrow="How it works" title={<span id="how-it-works">Four simple steps</span>} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 100} className="h-full">
                <div className="card relative h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-100 text-gold-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-display text-3xl text-navy-200" aria-hidden>
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 font-sans text-base font-semibold text-navy-900">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* The progress a referrer sees */}
          <Reveal className="mt-8">
            <div className="card p-6 sm:p-8">
              <p className="text-sm font-semibold text-navy-900">What you see on your dashboard</p>
              <p className="mt-1 text-sm text-navy-600">Each person you refer moves through these stages.</p>
              <ol className="mt-5 flex flex-wrap items-center gap-2" aria-label="Referral stages">
                {stages.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="rounded-full bg-navy-50 px-3.5 py-1.5 text-sm font-medium text-navy-800 ring-1 ring-navy-100">{s}</span>
                    {i < stages.length - 1 && <ArrowRight className="h-4 w-4 text-gold-600" aria-hidden />}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </section>

        {/* Who can refer */}
        <section className="mt-24" aria-labelledby="who-can-refer">
          <SectionHeading eyebrow="Who can refer" title={<span id="who-can-refer">Anyone who knows a future student</span>} />
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            {audiences.map(({ icon: Icon, title, text, cta }, i) => (
              <Reveal key={title} delay={i * 100} className="h-full">
                <div className="card flex h-full flex-col p-7">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 text-gold-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-sans text-lg font-semibold text-navy-900">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-navy-600">{text}</p>
                  <ButtonLink to={cta.to} variant="outline" size="sm" className="mt-6 self-start">
                    {cta.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </ButtonLink>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Good to know */}
        <section className="mx-auto mt-24 max-w-4xl" aria-labelledby="good-to-know">
          <Reveal>
            <div className="rounded-3xl border border-navy-100 bg-white p-7 sm:p-10">
              <h2 id="good-to-know" className="text-2xl text-navy-900 sm:text-3xl">
                Good to know
              </h2>
              <ul className="mt-6 space-y-4">
                {goodToKnow.map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-navy-700 sm:text-base">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* Final call to action */}
        <Reveal className="mt-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 px-8 py-14 text-center shadow-lift sm:px-16">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-2xl" aria-hidden />
            <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-navy-900/20 blur-2xl" aria-hidden />
            <h2 className="relative mx-auto max-w-2xl text-3xl text-navy-950 sm:text-4xl">Help someone take their first step</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-navy-900/80">Create your free referrer account and share your link today.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/referrer/register" variant="primary" size="lg">
                Become a referrer
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/referrer/login" variant="outline" size="lg" className="border-navy-900/20 bg-white/40">
                Referrer login
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </article>
  );
}
