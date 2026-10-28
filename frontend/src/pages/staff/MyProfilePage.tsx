import { useState, type FormEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CheckCircle2, GraduationCap, Languages, MapPin, Pencil, Users } from 'lucide-react';
import { PageHeader } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import type { User } from '../../lib/api/types';
import { ApiError } from '../../lib/api/types';
import { cn } from '../../lib/utils';

interface MatchingProfile {
  countries: { country: string; years: number }[];
  universities: string[];
  subjects: string[];
  languages: string[];
  capacity: number;
}

interface CareerOptions {
  directions: { key: string; label: string }[];
  destinations: string[];
}

const NO_OPTIONS: CareerOptions = { directions: [], destinations: [] };
const splitList = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

/** The form's values, as typed (years per country: empty = no experience there). */
interface Draft {
  name: string;
  years: Record<string, string>;
  subjects: string[];
  universities: string;
  languages: string;
  capacity: string;
}

const toDraft = (name: string, m: MatchingProfile): Draft => ({
  name,
  years: Object.fromEntries(m.countries.map((c) => [c.country, String(c.years)])),
  subjects: m.subjects,
  universities: m.universities.join(', '),
  languages: m.languages.join(', '),
  capacity: String(m.capacity),
});

/**
 * The counsellor's own profile: their name, and the countries, subjects, universities and languages they know and how many
 * students they can take. The admin's Assignments page uses it to suggest counsellors for new students; students never
 * see the matching details. It opens as a summary; "Edit profile" switches to the form.
 */
export function MyProfilePage() {
  const { user, updateUser } = useAuth();
  const [data, loaded] = useApi<{ matchingProfile: MatchingProfile; activeStudents: number } | null>('/staff/me/matching-profile', null);
  const [options] = useApi<CareerOptions>('/career-options', NO_OPTIONS);
  const [draft, setDraft] = useState<Draft | null>(null); // null = viewing
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!loaded || !data || !user) return null;
  const m = data.matchingProfile;
  const subjectLabel = (key: string) => options.directions.find((d) => d.key === key)?.label ?? key;

  const startEditing = () => {
    setDraft(toDraft(user.name, m));
    setError(null);
    setSaved(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (name.length < 2) return setError('Enter your full name.');
    const cap = Number(draft.capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) return setError('Capacity must be a whole number between 1 and 500.');
    const list = Object.entries(draft.years).filter(([, y]) => y.trim() !== '');
    if (list.some(([, y]) => !/^\d{1,2}$/.test(y.trim()))) return setError('Years must be a whole number (0–50).');
    setSaving(true);
    setError(null);
    try {
      if (name !== user.name) updateUser(await api.put<User>('/staff/me/name', { name }));
      await mutate(
        () =>
          api.put('/staff/me/matching-profile', {
            countries: list.map(([country, y]) => ({ country, years: Number(y) })),
            subjects: draft.subjects,
            universities: splitList(draft.universities),
            languages: splitList(draft.languages),
            capacity: cap,
          }),
        { silent: true },
      );
      setDraft(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My profile"
        description="What you know best. The admin uses it to match new students with the right counsellor; students don't see these details."
        action={
          !draft && (
            <Button onClick={startEditing} data-edit-profile>
              <Pencil className="h-4 w-4" aria-hidden /> Edit profile
            </Button>
          )
        }
      />
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Profile saved. Suggestions for new students use it straight away.
        </p>
      )}

      {draft ? <EditForm draft={draft} setDraft={setDraft} countries={Array.from(new Set([...options.destinations, ...m.countries.map((c) => c.country)]))} options={options} error={error} saving={saving} onSave={save} onCancel={() => setDraft(null)} /> : (
        <div className="grid gap-6 lg:grid-cols-12" data-profile-view>
          <aside className="space-y-6 lg:col-span-4">
            <Panel title="Account" icon={<Users className="h-4 w-4" aria-hidden />}>
              <dl className="space-y-3 text-sm">
                <Item label="Name">{user.name}</Item>
                <Item label="Email">{user.email}</Item>
                <Item label="Active students">
                  {data.activeStudents} of {m.capacity}
                </Item>
              </dl>
              <p className="mt-4 text-xs text-navy-400">To change your email or password, ask an administrator.</p>
            </Panel>
            <div className="rounded-2xl bg-sky-50 p-5 text-sm text-sky-900">
              <p className="font-semibold">How matching works</p>
              <p className="mt-1">
                When a student completes their profile, counsellors are ranked by experience with the student's country (50%), their subject area (30%) and spare capacity (20%). The admin
                makes the final choice.
              </p>
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <Panel title="Countries with experience" icon={<MapPin className="h-4 w-4" aria-hidden />}>
              <Tags empty="No countries added yet.">
                {m.countries.map((c) => (
                  <Tag key={c.country}>
                    {c.country} · {c.years} {c.years === 1 ? 'year' : 'years'}
                  </Tag>
                ))}
              </Tags>
            </Panel>
            <Panel title="Subject areas" icon={<BookOpen className="h-4 w-4" aria-hidden />}>
              <Tags empty="No subject areas chosen yet.">
                {m.subjects.map((s) => (
                  <Tag key={s}>{subjectLabel(s)}</Tag>
                ))}
              </Tags>
            </Panel>
            <Panel title="Background and capacity" icon={<GraduationCap className="h-4 w-4" aria-hidden />}>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <Item label="Universities you studied at">{m.universities.join(', ')}</Item>
                <Item label="Languages you speak">{m.languages.join(', ')}</Item>
                <Item label="Capacity">{m.capacity} active students</Item>
              </dl>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === '' || children == null;
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className={empty ? 'text-navy-300' : 'font-medium text-navy-900'}>{empty ? 'Not set' : children}</dd>
    </div>
  );
}

function Tags({ empty, children }: { empty: string; children: ReactNode[] }) {
  return children.length ? <div className="flex flex-wrap gap-2">{children}</div> : <p className="text-sm text-navy-300">{empty}</p>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-ivory px-3 py-1.5 text-xs font-semibold text-navy-800 ring-1 ring-navy-100">{children}</span>;
}

/* ------------------------------ Editing ------------------------------ */

function Section({ title, icon: Icon, hint, children }: { title: string; icon: LucideIcon; hint?: string; children: ReactNode }) {
  return (
    <Panel title={title} icon={<Icon className="h-4 w-4" aria-hidden />}>
      {hint && <p className="-mt-2 mb-4 text-sm text-navy-500">{hint}</p>}
      {children}
    </Panel>
  );
}

function EditForm({
  draft,
  setDraft,
  countries,
  options,
  error,
  saving,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  countries: string[];
  options: CareerOptions;
  error: string | null;
  saving: boolean;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <form onSubmit={onSave} noValidate className="space-y-6" data-matching-form>
      <Section title="Your name" icon={Users} hint="Shown to your students and in their records.">
        <div className="max-w-md">
          <TextField label="Full name" required value={draft.name} maxLength={100} autoComplete="name" onChange={(e) => set({ name: e.target.value })} data-name-input />
        </div>
      </Section>

      <Section title="Countries with experience" icon={MapPin} hint="Years working with each country's universities. Leave empty for none.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {countries.map((c) => (
            <label key={c} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 px-3 py-2 text-sm text-navy-800">
              {c}
              <span className="flex items-center gap-1.5 text-xs text-navy-500">
                <input
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  value={draft.years[c] ?? ''}
                  onChange={(e) => set({ years: { ...draft.years, [c]: e.target.value } })}
                  className="input w-20 py-1.5 text-right"
                  aria-label={`Years with ${c}`}
                />
                years
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Subject areas" icon={BookOpen} hint="The study areas you can advise on.">
        <div className="flex flex-wrap gap-2">
          {options.directions.map((d) => {
            const on = draft.subjects.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                onClick={() => set({ subjects: on ? draft.subjects.filter((x) => x !== d.key) : [...draft.subjects, d.key] })}
                className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', on ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50')}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Background and capacity" icon={GraduationCap}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Universities you studied at" placeholder="e.g. University of Leeds" hint="Separate with commas" value={draft.universities} onChange={(e) => set({ universities: e.target.value })} />
          <TextField label="Languages you speak" placeholder="e.g. English, Hindi, Marathi" hint="Separate with commas" value={draft.languages} onChange={(e) => set({ languages: e.target.value })} />
          <TextField
            label="Capacity (active students)"
            required
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={draft.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            hint="How many active students you can look after at once"
          />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-navy-400">
          <Languages className="h-3.5 w-3.5" aria-hidden /> Universities and languages are shown to the admin next to your suggestion; they don't change the score.
        </p>
      </Section>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 bg-[#F4F1EA]/95 px-1 py-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
