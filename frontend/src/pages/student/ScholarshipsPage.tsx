import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Award, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Search, XCircle } from 'lucide-react';
import { Pill } from '../../components/dashboard/Panel';
import { useStudent } from '../../components/student/StudentLayout';
import { SelectField, TextField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { INDIAN_STATES, OTHER_QUALIFICATION, QUALIFICATIONS, SCHOOL_QUALIFICATION } from '../../data/profileOptions';
import { api } from '../../lib/api/client';
import { useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { cn, formatDate } from '../../lib/utils';

interface Options {
  types: string[];
  states: string[];
  groups: string[];
  levels: string[];
  supportTypes: string[];
  categories: string[];
  total: number;
  updatedAt: string | null;
}

interface Scholarship {
  id: string;
  name: string;
  offeredBy: string;
  type: string;
  state: string;
  targetGroups: string[];
  targetGroupText: string;
  levels: string[];
  supportType: string;
  maxAmount: string | null;
  seatsPerYear: string | null;
  applicationWindow: string | null;
  coverage: string[];
  eligibility: string[];
  howToApply: string[];
  officialWebsite: string | null;
  notes: string | null;
  needsOffer: boolean | null;
  onePerFamily: boolean | null;
  lastChecked: string;
  sourceUrl: string | null;
  eligible: boolean | null;
  unmet: string[];
}

interface Results {
  total: number;
  eligible: number | null;
  items: Scholarship[];
  pageSize: number;
}

/** Scholarships per page; the same as the API's page size. */
const PAGE_SIZE = 5;

const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));

const NO_FILTERS = { type: '', state: '', group: '', level: '', support: '' };
const NO_ELIGIBILITY = { homeState: '', category: '', disability: '', studyLevel: '', incomeLakh: '', age: '', marks: '', qsRank: '', workYears: '' };

/** "72%" or "72" → "72". A CGPA or anything else isn't a percentage, so it's left for the student to enter. */
const percent = (text?: string) => {
  const found = /^\s*([\d.]+)\s*(%?)\s*$/.exec(text ?? '');
  return found && (found[2] || Number(found[1]) > 10) ? found[1]! : '';
};

/** The level a student usually applies for next, from their highest qualification. */
const nextLevel = (degree: string) => {
  if (!QUALIFICATIONS.includes(degree) || degree === OTHER_QUALIFICATION) return '';
  if (degree === SCHOOL_QUALIFICATION || /diploma/i.test(degree)) return 'Undergraduate';
  if (/^(m\.|mba|mca)/i.test(degree)) return 'PhD';
  if (/^ph\.?d/i.test(degree)) return 'Post-doctoral';
  return "Master's";
};

/** Age on today's date, from YYYY-MM-DD. */
const ageFrom = (dob: string) => {
  const d = new Date(dob);
  if (!dob || Number.isNaN(d.getTime())) return '';
  const t = new Date();
  const age = t.getFullYear() - d.getFullYear() - (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate()) ? 1 : 0);
  return age > 0 ? String(age) : '';
};

/** "2 years · Data Analyst" → "2". */
const yearsFrom = (text: string) => /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i.exec(text ?? '')?.[1] ?? '';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-navy-500">{label}</dt>
      <dd className="mt-1 text-sm text-navy-900">{value}</dd>
    </div>
  );
}

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-500">{title}</h4>
      <Tag className={cn('mt-2 space-y-1 pl-5 text-sm text-navy-800', ordered ? 'list-decimal' : 'list-disc')}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </Tag>
    </div>
  );
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages < 2) return null;
  const btn = 'grid h-9 min-w-9 place-items-center rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center justify-center gap-1.5" data-scholarships-pages>
      <button type="button" className={cn(btn, 'text-navy-700 hover:bg-navy-50')} disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="sr-only">Previous page</span>
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? 'page' : undefined}
          className={cn(btn, n === page ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-50')}
          onClick={() => onChange(n)}
          data-page={n}
        >
          {n}
        </button>
      ))}
      <button type="button" className={cn(btn, 'text-navy-700 hover:bg-navy-50')} disabled={page === pages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" aria-hidden />
        <span className="sr-only">Next page</span>
      </button>
    </nav>
  );
}

function ScholarshipCard({ s }: { s: Scholarship }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl border-t-2 border-gold-500 bg-white p-4 ring-1 ring-navy-100 sm:p-5" data-scholarship={s.id}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy-900 text-gold-400">
          <Award className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <h3 className="font-sans text-base font-semibold text-navy-900 sm:text-lg">{s.name}</h3>
            {s.eligible !== null &&
              (s.eligible ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" data-eligible>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> You may be eligible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600" data-not-eligible>
                  <XCircle className="h-3.5 w-3.5" aria-hidden /> Not eligible
                </span>
              ))}
          </div>
          <p className="mt-0.5 text-sm text-navy-600">{s.offeredBy}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill tone="blue">{s.type}</Pill>
        <Pill tone="grey">{s.state}</Pill>
        <Pill tone="gold">{s.supportType}</Pill>
        {s.needsOffer && <Pill tone="amber">Apply after you get an offer</Pill>}
        {s.onePerFamily && <Pill tone="grey">One per family</Pill>}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Target group" value={s.targetGroupText} />
        <Fact label="Level of study" value={s.levels.join(', ')} />
        <Fact label="Maximum amount" value={s.maxAmount ?? '—'} />
        <Fact label="Seats per year" value={s.seatsPerYear ?? '—'} />
        <Fact label="Usual application window" value={s.applicationWindow ?? '—'} />
      </dl>

      {s.unmet.length > 0 && <p className="mt-3 text-xs text-red-600">{s.unmet.join(' · ')}</p>}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-950"
        data-scholarship-details
      >
        {open ? 'Hide details' : 'View details'} <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-navy-100 pt-4">
          <List title="Coverage" items={s.coverage} />
          <List title="Eligibility" items={s.eligibility} />
          <List title="How to apply" items={s.howToApply} ordered />
          {s.notes && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-500">Notes</h4>
              <p className="mt-2 text-sm text-navy-800">{s.notes}</p>
            </div>
          )}
          {s.officialWebsite && (
            <a href={s.officialWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 underline-offset-2 hover:underline">
              Official website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-navy-400" data-checked>
        Figures checked {formatDate(s.lastChecked)}
        {s.sourceUrl && (
          <>
            {' · '}
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-600 underline-offset-2 hover:underline">
              Source
            </a>
          </>
        )}
      </p>
    </li>
  );
}

/** Explore Scholarships: Indian government and trust scholarships for study abroad, with an eligibility check. */
export function ScholarshipsPage() {
  const { profile } = useStudent();
  const [opts, loaded] = useApi<Options | null>('/scholarships/options', null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [searched, setSearched] = useState(NO_FILTERS);
  const [mine, setMine] = useState({
    ...NO_ELIGIBILITY,
    homeState: profile.state || '',
    studyLevel: nextLevel(profile.degree),
    age: ageFrom(profile.dateOfBirth),
    marks: percent(profile.degree === SCHOOL_QUALIFICATION ? profile.hscScore || profile.grade : profile.grade),
    workYears: yearsFrom(profile.workExperience),
  });
  const [applied, setApplied] = useState<typeof mine | null>(null);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const top = useRef<HTMLHeadingElement>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(searched).forEach(([k, v]) => v && p.set(k, v));
    if (applied) {
      Object.entries(applied).forEach(([k, v]) => v.trim() && p.set(k, v.trim()));
      if (eligibleOnly) p.set('eligibleOnly', 'true');
    }
    return p.toString();
  }, [searched, applied, eligibleOnly]);

  // A new search or eligibility check starts again from the first page.
  useEffect(() => setPage(1), [query]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    api
      .get<Results>(`/scholarships?${query}${query ? '&' : ''}offset=${(page - 1) * PAGE_SIZE}`)
      .then((r) => {
        if (!current) return;
        setResults(r);
        setError(null);
      })
      .catch((err) => current && setError(err instanceof ApiError && err.status === 422 ? 'Please check the numbers you entered.' : 'Scholarships could not be loaded. Please try again.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [query, page]);

  const goTo = (n: number) => {
    setPage(n);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const set = (key: keyof typeof filters) => (e: ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const setMineField = (key: keyof typeof mine) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setMine((m) => ({ ...m, [key]: e.target.value }));

  const search = (e: FormEvent) => {
    e.preventDefault();
    setSearched(filters);
  };

  const reset = () => {
    setMine(NO_ELIGIBILITY);
    setApplied(null);
    setEligibleOnly(false);
  };

  if (loaded && !opts) {
    return (
      <p role="alert" className="card p-10 text-center text-sm text-navy-500" data-scholarships-failed>
        Scholarships could not be loaded. Please refresh the page and try again.
      </p>
    );
  }

  if (loaded && !opts?.total) {
    return (
      <div className="card p-10 text-center" data-scholarships-empty>
        <Award className="mx-auto h-8 w-8 text-gold-600" aria-hidden />
        <p className="mt-3 font-semibold text-navy-900">Our scholarship list is on its way</p>
        <p className="mt-1 text-sm text-navy-500">Your Financial Aid Officer can suggest scholarships for you in the meantime.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-scholarships>
      <h2 ref={top} className="scroll-mt-24 font-sans text-xl font-semibold text-navy-900 sm:text-2xl" role="status" data-scholarships-count>
        {results ? `${results.total} ${results.total === 1 ? 'scholarship' : 'scholarships'} found` : 'Finding scholarships…'}
      </h2>

      <form onSubmit={search} className="card relative mt-4 px-5 pb-9 pt-5" aria-label="Search" data-scholarships-search>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField clearable label="Offered by" placeholder="Anyone" options={options(opts?.types ?? [])} value={filters.type} onChange={set('type')} />
          <SelectField clearable label="State" placeholder="Any state" options={options(opts?.states ?? [])} value={filters.state} onChange={set('state')} />
          <SelectField clearable label="Target group" placeholder="Any group" options={options(opts?.groups ?? [])} value={filters.group} onChange={set('group')} />
          <SelectField clearable label="Level of study" placeholder="Any level" options={options(opts?.levels ?? [])} value={filters.level} onChange={set('level')} />
          <SelectField clearable label="Type of support" placeholder="Any type" options={options(opts?.supportTypes ?? [])} value={filters.support} onChange={set('support')} />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <Button type="submit" className="hover:!translate-y-0" data-scholarships-submit>
            Search <Search className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </form>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="min-w-0 lg:col-span-4 xl:col-span-3">
          <section className="card space-y-4 p-5" aria-label="Eligibility" data-scholarship-eligibility>
            <div>
              <h2 className="font-sans text-base font-semibold text-navy-900">Eligibility</h2>
              <p className="mt-1 text-xs text-navy-500">Filled in from your profile where we can. Your category and income are only used for this check and aren't saved.</p>
            </div>
            <SelectField clearable label="Home state" placeholder="Select" options={options(INDIAN_STATES)} value={mine.homeState} onChange={setMineField('homeState')} />
            <SelectField clearable label="Category" placeholder="Select" options={options(opts?.categories ?? [])} value={mine.category} onChange={setMineField('category')} />
            <SelectField clearable label="Do you have a disability?" placeholder="Select" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} value={mine.disability} onChange={setMineField('disability')} />
            <SelectField clearable label="Level you're applying for" placeholder="Select" options={options(opts?.levels ?? [])} value={mine.studyLevel} onChange={setMineField('studyLevel')} />
            <TextField label="Annual family income (₹ lakh)" inputMode="decimal" placeholder="e.g. 6" value={mine.incomeLakh} onChange={setMineField('incomeLakh')} />
            <TextField label="Age" inputMode="numeric" placeholder="Enter age" value={mine.age} onChange={setMineField('age')} />
            <TextField label="Marks in your last degree (%)" inputMode="decimal" placeholder="Enter score" value={mine.marks} onChange={setMineField('marks')} />
            <TextField label="University's QS ranking" inputMode="numeric" placeholder="If you know it" value={mine.qsRank} onChange={setMineField('qsRank')} />
            <TextField label="Years of full-time work" inputMode="decimal" placeholder="Enter years" value={mine.workYears} onChange={setMineField('workYears')} />
            <div className="grid grid-cols-2 gap-3 border-t border-navy-100 pt-4">
              <Button variant="outline" size="sm" onClick={reset} data-scholarship-eligibility-reset>
                Reset <RotateCcw className="h-4 w-4" aria-hidden />
              </Button>
              <Button size="sm" onClick={() => setApplied(mine)} data-scholarship-eligibility-apply>
                Apply <Search className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {applied && (
              <label className="flex items-start gap-2 text-sm text-navy-700">
                <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="mt-0.5 h-4 w-4 accent-navy-900" data-scholarship-eligible-only />
                Only show scholarships I may be eligible for
              </label>
            )}
          </section>
        </aside>

        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          {results && results.eligible !== null && !eligibleOnly && (
            <p className="mb-4 text-sm text-navy-600" data-scholarships-eligible-count>
              You may be eligible for <span className="font-semibold text-navy-900">{results.eligible}</span>
            </p>
          )}

          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {results && !results.total ? (
            <div className="card p-10 text-center text-sm text-navy-500">No scholarships match. Try removing a filter.</div>
          ) : (
            <>
              <ul className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
                {results?.items.map((s) => (
                  <ScholarshipCard key={s.id} s={s} />
                ))}
              </ul>
              {results && (
                <>
                  <Pager page={page} pages={Math.ceil(results.total / PAGE_SIZE)} onChange={goTo} />
                  <p className="mt-2 text-center text-xs text-navy-500" data-scholarships-range>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, results.total)} of {results.total}
                  </p>
                </>
              )}
            </>
          )}

          <p className="mt-5 text-xs text-navy-400">
            Amounts, seats and rules change every year, and meeting them doesn't guarantee an award. Check the official website and talk to your counsellor or Financial Aid Officer
            before you apply.
            {opts?.updatedAt && ` Updated ${formatDate(opts.updatedAt)}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
