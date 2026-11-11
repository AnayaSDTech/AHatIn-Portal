import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Award, GraduationCap, Lock, MapPin, Users } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { ButtonLink } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import { useCanHover } from '../../hooks/useCanHover';

type PreviewItem = {
  id: string;
  name: string;
  offeredBy: string;
  type: string;
  state: string;
  levels: string[];
  supportType: string;
  maxAmount: string | null;
  targetGroupText: string;
};

type Preview = { total: number; central: number; states: number; items: PreviewItem[] };

/**
 * Home page: a few government and trust scholarships for study abroad, with the basics only.
 * The full details (coverage, eligibility, how to apply) are in the student portal, so visitors are sent to register.
 * Hidden if the list can't be loaded, so the home page never shows an error.
 */
const cardBase = 'flex flex-col rounded-2xl border bg-white p-6';

/** Always visible: what the scholarship is, who offers it and how much. */
function Summary({ s }: { s: PreviewItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-400 transition group-data-[open=true]:bg-gold-500 group-data-[open=true]:text-navy-950">
          <Award className="h-5 w-5" aria-hidden />
        </span>
        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-700">{s.type}</span>
      </div>
      <h3 className="mt-5 font-sans text-base font-semibold leading-snug text-navy-900">{s.name}</h3>
      <p className="mt-1 text-xs text-navy-500">{s.offeredBy}</p>
      {s.maxAmount && (
        <div className="mt-auto pt-5">
          <p className="rounded-xl bg-gold-50 px-3 py-2 text-sm text-navy-800">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-navy-500">{s.supportType}</span>
            {s.maxAmount}
          </p>
        </div>
      )}
    </>
  );
}

/** Shown on hover (always on touch screens): where, who for, which level, and the way to the full details. */
function Details({ s, to, isStudent }: { s: PreviewItem; to: string; isStudent: boolean }) {
  return (
    <>
      <ul className="mt-4 space-y-2 text-sm text-navy-700">
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden /> {s.state}
        </li>
        <li className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden /> {s.targetGroupText}
        </li>
        <li className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden /> {s.levels.join(', ')}
        </li>
      </ul>
      <Link
        to={to}
        className="mt-4 flex items-center gap-1 border-t border-navy-100 pt-4 text-sm font-semibold text-navy-900 outline-none transition hover:text-gold-700 focus-visible:text-gold-700 focus-visible:underline"
        aria-label={`View full details of ${s.name}`}
      >
        {isStudent ? null : <Lock className="h-3.5 w-3.5" aria-hidden />}
        Eligibility & how to apply
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </>
  );
}

export function Scholarships() {
  const { user } = useAuth();
  const canHover = useCanHover();
  const [data, setData] = useState<Preview | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<Preview>('/scholarships/preview')
      .then((d) => live && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!data || data.items.length === 0) return null;

  const isStudent = user?.role === 'student' || user?.role === 'parent';
  const fullList = isStudent ? '/dashboard/scholarships' : '/register';
  const cta = isStudent ? 'See all scholarships' : 'Register free for full details';

  return (
    <section id="scholarships" className="relative scroll-mt-24 bg-ivory py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Scholarships for study abroad"
          title={<>Funding your degree <span className="italic text-gold-600">is possible</span></>}
          description={`${data.total} scholarships and loans for studying abroad: ${data.central} central schemes, plus awards from ${data.states} states and private trusts.`}
        />

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((s, i) => {
            const details = <Details s={s} to={fullList} isStudent={isStudent} />;

            // Touch screens: a plain card with its details always shown.
            if (!canHover) {
              return (
                <li key={s.id}>
                  <Reveal delay={(i % 3) * 80} className="h-full">
                    <article className={cn(cardBase, 'h-full border-navy-100')}>
                      <Summary s={s} />
                      {details}
                    </article>
                  </Reveal>
                </li>
              );
            }

            // Mouse: the card keeps its place in the grid (held by an invisible copy of the summary). The visible card
            // sits on top of that place and, when opened, grows downwards over the cards below without moving them.
            const open = active === s.id;
            const dimmed = active !== null && !open;
            const close = () => setActive((a) => (a === s.id ? null : a));
            return (
              <li key={s.id} className={cn('relative', open && 'z-20')}>
                <Reveal delay={(i % 3) * 80} className="h-full">
                  <div className="relative h-full">
                    <div className={cn(cardBase, 'invisible h-full border-transparent')} aria-hidden>
                      <Summary s={s} />
                    </div>
                    <article
                      data-open={open}
                      onMouseEnter={() => setActive(s.id)}
                      onMouseLeave={close}
                      // Keyboard: tabbing to the card's link opens it; leaving the card closes it.
                      onFocus={() => setActive(s.id)}
                      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && close()}
                      className={cn(
                        cardBase,
                        'group absolute inset-x-0 top-0 min-h-full overflow-hidden transition-all duration-500 ease-out',
                        open ? 'border-gold-300 shadow-2xl shadow-navy-900/20' : 'border-navy-100',
                        dimmed && 'scale-[0.98] opacity-50 blur-[2px]',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-gold-400 to-gold-600 transition-transform duration-500',
                          open ? 'scale-x-100' : 'scale-x-0',
                        )}
                        aria-hidden
                      />
                      <Summary s={s} />
                      {/* Details: height animates from 0 to their natural size. Still read by screen readers when closed. */}
                      <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                        <div className={cn('min-h-0 overflow-hidden transition-opacity duration-500', open ? 'opacity-100' : 'opacity-0')}>
                          {details}
                        </div>
                      </div>
                    </article>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>

        <Reveal className="mt-12 flex flex-col items-center gap-3 text-center">
          <ButtonLink to={fullList} variant="gold" size="lg">
            {cta}
          </ButtonLink>
          {!isStudent && (
            <p className="max-w-md text-sm text-navy-500">
              Free account: see all {data.total}, check your eligibility and get help applying.
            </p>
          )}
        </Reveal>
      </Container>
    </section>
  );
}
