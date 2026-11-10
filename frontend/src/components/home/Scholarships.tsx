import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Award, GraduationCap, Lock, MapPin, Users } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { ButtonLink } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api/client';

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
export function Scholarships() {
  const { user } = useAuth();
  const [data, setData] = useState<Preview | null>(null);

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

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((s, i) => (
            <Reveal key={s.id} delay={(i % 3) * 80}>
              <article className="group flex h-full flex-col rounded-2xl border border-navy-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold-300 hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-400 transition group-hover:bg-gold-500 group-hover:text-navy-950">
                    <Award className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-700">{s.type}</span>
                </div>
                <h3 className="mt-5 font-sans text-base font-semibold leading-snug text-navy-900">{s.name}</h3>
                <p className="mt-1 text-xs text-navy-500">{s.offeredBy}</p>

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

                <div className="mt-auto pt-5">
                  {s.maxAmount && (
                    <p className="rounded-xl bg-gold-50 px-3 py-2 text-sm text-navy-800">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-navy-500">{s.supportType}</span>
                      {s.maxAmount}
                    </p>
                  )}
                  <Link
                    to={fullList}
                    className="mt-4 flex items-center gap-1 border-t border-navy-100 pt-4 text-sm font-semibold text-navy-900 transition hover:text-gold-700"
                    aria-label={`View full details of ${s.name}`}
                  >
                    {isStudent ? null : <Lock className="h-3.5 w-3.5" aria-hidden />}
                    Eligibility & how to apply
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

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
