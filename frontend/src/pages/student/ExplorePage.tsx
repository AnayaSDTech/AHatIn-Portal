import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, GraduationCap, MapPin, RotateCcw, Search, XCircle } from 'lucide-react';
import { Pill } from '../../components/dashboard/Panel';
import { useStudent } from '../../components/student/StudentLayout';
import { SelectField, TextField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { OTHER_QUALIFICATION, QUALIFICATIONS, SCHOOL_QUALIFICATION } from '../../data/profileOptions';
import { api } from '../../lib/api/client';
import { useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { cn, formatDate } from '../../lib/utils';

interface Options {
  destinations: string[];
  levels: string[];
  areas: string[];
  intakes: string[];
  years: string[];
  qualifications: string[];
  englishTests: string[];
  total: number;
  updatedAt: string | null;
}

interface Course {
  id: string;
  university: string;
  country: string;
  course: string;
  level: string;
  area: string;
  intakes: string[];
  years: string[];
  status: 'Open' | 'Closed';
  durationMonths: number | null;
  tuitionPerYear: number | null;
  currency: string;
  applicationFee: number | null;
  avgScholarship: number | null;
  featured: boolean;
  qsRanking: number | null;
  sourceUrl: string | null;
  checkedOn: string | null;
  eligible: boolean | null;
  unmet: string[];
}

interface Results {
  total: number;
  universities: number;
  eligible: number | null;
  items: Course[];
  pageSize: number;
}

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'qs', label: 'QS Ranking' },
  { value: 'tuition', label: 'Tuition Fees' },
];

const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));

const money = (value: number | null, currency: string) => (value === null ? '—' : `${currency} ${value.toLocaleString('en-GB')}`);

const NO_FILTERS = { destination: '', level: '', area: '', intake: '', year: '' };
const NO_ELIGIBILITY = { qualification: '', ugPercent: '', hscPercent: '', backlogs: '', englishTest: '', englishScore: '' };

/** "72%" or "72" → "72". A CGPA or anything else isn't a percentage, so it's left for the student to enter. */
const percent = (text?: string) => {
  const found = /^\s*([\d.]+)\s*(%?)\s*$/.exec(text ?? '');
  return found && (found[2] || Number(found[1]) > 10) ? found[1]! : '';
};

/** The profile's qualification, as one of the levels courses ask for. */
const levelOf = (degree: string) => {
  if (!QUALIFICATIONS.includes(degree) || degree === OTHER_QUALIFICATION) return '';
  if (degree === SCHOOL_QUALIFICATION || /diploma/i.test(degree)) return '12th';
  if (/^(m\.|mba|mca|ph\.?d)/i.test(degree)) return "Master's";
  return "Bachelor's";
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-navy-500">{label}</dt>
      <dd className="mt-1 text-sm text-navy-900">{value}</dd>
    </div>
  );
}

function CourseCard({ c }: { c: Course }) {
  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-navy-100 sm:p-5" data-course={c.course}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="font-sans text-base font-semibold text-navy-900">{c.course}</h3>
        {c.eligible !== null &&
          (c.eligible ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" data-eligible>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> You may be eligible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600" data-not-eligible>
              <XCircle className="h-3.5 w-3.5" aria-hidden /> Not eligible
            </span>
          ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill tone={c.status === 'Open' ? 'green' : 'grey'}>{c.status}</Pill>
        {c.intakes.map((m) => (
          <span key={m} className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-600">
            {m}
          </span>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Duration" value={c.durationMonths ? `${c.durationMonths} months` : '—'} />
        <Fact label="Tuition/yr" value={money(c.tuitionPerYear, c.currency)} />
        <Fact label="Application Fee" value={c.applicationFee === 0 ? 'No Application Fee' : money(c.applicationFee, c.currency)} />
        <Fact label="Avg. Scholarship" value={money(c.avgScholarship, c.currency)} />
        <Fact label="Study Level" value={c.level} />
      </dl>
      {c.unmet.length > 0 && <p className="mt-3 text-xs text-red-600">{c.unmet.join(' · ')}</p>}
      {c.checkedOn && (
        <p className="mt-3 text-xs text-navy-400" data-checked>
          Figures checked {formatDate(c.checkedOn)}
          {c.sourceUrl && (
            <>
              {' · '}
              <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-600 underline-offset-2 hover:underline">
                University website
              </a>
            </>
          )}
        </p>
      )}
    </li>
  );
}

/** Explore Universities: search the course list, check eligibility, and sort. */
export function ExplorePage() {
  const { profile } = useStudent();
  const [opts, loaded] = useApi<Options | null>('/courses/options', null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [searched, setSearched] = useState(NO_FILTERS);
  const [sort, setSort] = useState('featured');
  const [mine, setMine] = useState({
    qualification: levelOf(profile.degree),
    ugPercent: percent(profile.degree === SCHOOL_QUALIFICATION ? '' : profile.grade),
    hscPercent: percent(profile.hscScore || (profile.degree === SCHOOL_QUALIFICATION ? profile.grade : '')),
    backlogs: '',
    englishTest: profile.englishTest || '',
    englishScore: profile.englishScore || '',
  });
  const [applied, setApplied] = useState<typeof mine | null>(null);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [extra, setExtra] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(searched).forEach(([k, v]) => v.trim() && p.set(k, v.trim()));
    p.set('sort', sort);
    if (applied) {
      Object.entries(applied).forEach(([k, v]) => v.trim() && p.set(k, v.trim()));
      if (eligibleOnly) p.set('eligibleOnly', 'true');
    }
    return p.toString();
  }, [searched, sort, applied, eligibleOnly]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    api
      .get<Results>(`/courses?${query}`)
      .then((r) => {
        if (!current) return;
        setResults(r);
        setExtra([]);
        setError(null);
      })
      .catch((err) => current && setError(err instanceof ApiError && err.status === 422 ? 'Please check the numbers you entered.' : 'Courses could not be loaded. Please try again.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [query]);

  const set = (key: keyof typeof filters) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const setMineField = (key: keyof typeof mine) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setMine((m) => ({ ...m, [key]: e.target.value }));
  const courses = [...(results?.items ?? []), ...extra];
  // Kept in sorted order, with each university shown once, where its first course falls.
  const universities = useMemo(() => {
    const groups = new Map<string, Course[]>();
    courses.forEach((c) => groups.set(c.university, [...(groups.get(c.university) ?? []), c]));
    return [...groups.entries()];
  }, [courses]);

  const sample = courses.some((c) => c.university.startsWith('Demo '));

  const search = (e: FormEvent) => {
    e.preventDefault();
    setSearched(filters);
  };

  // Each qualification only asks for the scores that apply to it.
  const asksHsc = !!mine.qualification;
  const asksUg = asksHsc && mine.qualification !== '12th';

  const apply = () => setApplied({ ...mine, ugPercent: asksUg ? mine.ugPercent : '', hscPercent: asksHsc ? mine.hscPercent : '', backlogs: asksUg ? mine.backlogs : '', englishScore: mine.englishTest && mine.englishTest !== 'Not taken yet' ? mine.englishScore : '' });

  const reset = () => {
    setMine(NO_ELIGIBILITY);
    setApplied(null);
    setEligibleOnly(false);
  };

  const more = async () => {
    const r = await api.get<Results>(`/courses?${query}&offset=${courses.length}`);
    setExtra((e) => [...e, ...r.items]);
  };

  if (loaded && !opts) {
    return (
      <p role="alert" className="card p-10 text-center text-sm text-navy-500" data-explore-failed>
        Courses could not be loaded. Please refresh the page and try again.
      </p>
    );
  }

  if (loaded && !opts?.total) {
    return (
      <div className="card p-10 text-center" data-explore-empty>
        <GraduationCap className="mx-auto h-8 w-8 text-gold-600" aria-hidden />
        <p className="mt-3 font-semibold text-navy-900">Our course list is on its way</p>
        <p className="mt-1 text-sm text-navy-500">Your counsellor can suggest universities for you in the meantime.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-explore>
      <h2 className="font-sans text-xl font-semibold text-navy-900 sm:text-2xl" role="status" data-explore-count>
        {results ? `${results.total} ${results.total === 1 ? 'course' : 'courses'} in ${results.universities} ${results.universities === 1 ? 'university' : 'universities'} found` : 'Finding courses…'}
      </h2>

      <form onSubmit={search} className="card relative mt-4 px-5 pb-9 pt-5" aria-label="Search" data-explore-search>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField clearable label="Preferred Destination" placeholder="Any destination" options={options(opts?.destinations ?? [])} value={filters.destination} onChange={set('destination')} />
          <SelectField clearable label="Preferred Program Level" placeholder="Any level" options={options(opts?.levels ?? [])} value={filters.level} onChange={set('level')} />
          <SelectField clearable label="Preferred Study Area" placeholder="Any study area" options={options(opts?.areas ?? [])} value={filters.area} onChange={set('area')} />
          <SelectField clearable label="Preferred Intake" placeholder="Any intake" options={options(opts?.intakes ?? [])} value={filters.intake} onChange={set('intake')} />
          <SelectField clearable label="Preferred Year" placeholder="Any year" options={options(opts?.years ?? [])} value={filters.year} onChange={set('year')} />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <Button type="submit" className="hover:!translate-y-0" data-explore-submit>
            Search <Search className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </form>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="min-w-0 lg:col-span-4 xl:col-span-3">
          <section className="card space-y-4 p-5" aria-label="Eligibility" data-eligibility-form>
            <div>
              <h2 className="font-sans text-base font-semibold text-navy-900">Eligibility</h2>
              <p className="mt-1 text-xs text-navy-500">Filled in from your profile where we can.</p>
            </div>
            <SelectField clearable label="Highest Qualification Studied" required placeholder="Select" options={(opts?.qualifications ?? []).map((q) => ({ value: q, label: q === '12th' ? '12th or equivalent' : q }))} value={mine.qualification} onChange={setMineField('qualification')} />
            {asksUg && <TextField label="Undergraduate Score (%)" inputMode="decimal" placeholder="Enter score" value={mine.ugPercent} onChange={setMineField('ugPercent')} />}
            {asksHsc && <TextField label="12th Score (%)" inputMode="decimal" placeholder="Enter score" value={mine.hscPercent} onChange={setMineField('hscPercent')} />}
            {asksUg && <TextField label="Backlogs" inputMode="numeric" placeholder="Enter backlogs" value={mine.backlogs} onChange={setMineField('backlogs')} />}
            <SelectField clearable label="English Proficiency Exam" placeholder="Select" options={options(opts?.englishTests ?? [])} value={mine.englishTest} onChange={setMineField('englishTest')} />
            {mine.englishTest && mine.englishTest !== 'Not taken yet' && <TextField label={`${mine.englishTest} Score`} inputMode="decimal" placeholder="Enter score" value={mine.englishScore} onChange={setMineField('englishScore')} />}
            <div className="grid grid-cols-2 gap-3 border-t border-navy-100 pt-4">
              <Button variant="outline" size="sm" onClick={reset} data-eligibility-reset>
                Reset <RotateCcw className="h-4 w-4" aria-hidden />
              </Button>
              <Button size="sm" disabled={!mine.qualification} onClick={apply} data-eligibility-apply>
                Apply <Search className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {applied && (
              <label className="flex items-start gap-2 text-sm text-navy-700">
                <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="mt-0.5 h-4 w-4 accent-navy-900" data-eligible-only />
                Only show courses I may be eligible for
              </label>
            )}
          </section>
        </aside>

        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-96 [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&_label]:mb-0 [&_label]:shrink-0">
              <SelectField label="Sort By" options={SORTS} value={sort} onChange={(e) => setSort(e.target.value)} data-explore-sort />
            </div>
            {results && results.eligible !== null && !eligibleOnly && (
              <p className="text-sm text-navy-600" data-explore-eligible-count>
                You may be eligible for <span className="font-semibold text-navy-900">{results.eligible}</span>
              </p>
            )}
          </div>

          {sample && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-explore-sample>
              This is a sample list. The universities are invented and the figures are examples, so please don't use them to plan your application.
            </p>
          )}

          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {results && !results.total ? (
            <div className="card p-10 text-center text-sm text-navy-500">No courses match. Try removing a filter.</div>
          ) : (
            <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
              {universities.map(([name, list]) => (
                <section key={name} className="overflow-hidden rounded-2xl border-t-2 border-gold-500 bg-navy-50/60 p-4 sm:p-5" aria-label={name} data-university={name}>
                  <header className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-navy-900 text-gold-400">
                      <GraduationCap className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="font-sans text-lg font-semibold text-navy-900">{name}</h2>
                        {list[0]!.featured && (
                          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800" data-featured>
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-sm text-navy-600">
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> {list[0]!.country}
                        {list[0]!.qsRanking !== null && <span data-qs> · QS Ranking #{list[0]!.qsRanking}</span>}
                      </p>
                    </div>
                  </header>
                  <ul className="mt-4 space-y-3">
                    {list.map((c) => (
                      <CourseCard key={c.id} c={c} />
                    ))}
                  </ul>
                </section>
              ))}
              {results && courses.length < results.total && (
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={() => void more()} data-explore-more>
                    Show more
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="mt-5 text-xs text-navy-400">
            Fees and entry requirements can change, and meeting them doesn't guarantee an offer. Check with your counsellor before you apply.
            {opts?.updatedAt && ` Updated ${formatDate(opts.updatedAt)}.`}
          </p>
          <p className="mt-2 text-xs text-navy-400" data-explore-notes>
            We apply to universities through our partner agencies, and your counsellor will confirm which of these we can apply to for you. Rankings are from the QS World University Rankings.
          </p>
        </div>
      </div>
    </div>
  );
}
