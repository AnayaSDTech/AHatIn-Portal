import { useState, type ReactNode } from 'react';
import { Clock, ListChecks, Lock, Moon, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/FormField';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { PageHeader } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import { cn } from '../../lib/utils';
import type { FollowUpRule } from '../../data/staff';

interface WorkingHours {
  /** 0 = Monday … 6 = Sunday. */
  days: number[];
  start: string;
  end: string;
}

interface QuietHours {
  start: string;
  end: string;
}

interface FollowUpLimits {
  firstContactMinutes: number;
  firstContactNextDay: string;
  bookSessionHours: number;
  planFollowUpHours: number;
  documentCheckWorkingDays: number;
  deadlineReminderDays: number[];
}

interface Settings {
  workingHours: WorkingHours & { label: string };
  quietHours: QuietHours;
  followUpLimits: FollowUpLimits;
  staffSecurity: { twoStep: boolean; idleMinutes: number; maxHours: number };
  followUpRules: (FollowUpRule & { setting?: string })[];
  /** Admins can change working hours, quiet hours and follow-up time limits. */
  canEdit: boolean;
  /** The demo data can be reset: development on a local or test database only, never the live one. */
  demoTools: boolean;
}

type Section = 'workingHours' | 'quietHours' | 'followUps';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function SettingsPage() {
  const [settings] = useApi<Settings | null>('/settings', null);
  const [editing, setEditing] = useState<Section | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [resetting, setResetting] = useState(false);
  const reset = async () => {
    setResetting(true);
    try {
      await mutate(() => api.post('/admin/demo/reset'));
      setDone(true);
    } catch {
      /* shown in the message bar */
    } finally {
      setResetting(false);
      setConfirm(false);
    }
  };
  if (!settings) return null;
  const { workingHours, quietHours, staffSecurity, canEdit } = settings;
  const edit = (section: Section) =>
    canEdit ? (
      <Button variant="outline" size="sm" onClick={() => { setSaved(null); setEditing(section); }} aria-label={`Edit ${SECTION_TITLES[section].toLowerCase()}`} data-edit={section}>
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
      </Button>
    ) : undefined;

  return (
    <>
      <PageHeader title="Settings" description="Working hours, quiet hours, staff security and follow-up rules." />

      {saved && (
        <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-settings-saved>
          {saved} saved. New follow-ups use the new values; ones already in staff lists keep their due times.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Working hours" icon={<Clock className="h-4 w-4" aria-hidden />} action={edit('workingHours')}>
          {/* An older backend sends the days as text, with no label. */}
          <p className="text-sm text-navy-700">{workingHours.label ?? String(workingHours.days)}</p>
          <p className="font-display text-2xl text-navy-900">{workingHours.start} – {workingHours.end} IST</p>
          <p className="mt-2 text-xs text-navy-400">Follow-up time limits count only working hours where a rule says so.</p>
        </Panel>
        <Panel title="Quiet hours" icon={<Moon className="h-4 w-4" aria-hidden />} action={edit('quietHours')}>
          <p className="font-display text-2xl text-navy-900">{quietHours.start} – {quietHours.end}</p>
          <p className="mt-2 text-xs text-navy-400">Non-urgent emails to students and parents wait until quiet hours end.</p>
        </Panel>
        <Panel title="Staff security" icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
          <ul className="space-y-1.5 text-sm text-navy-700">
            <li>2-step verification: <span className="font-semibold">{staffSecurity.twoStep ? 'required' : 'optional'}</span></li>
            <li>Idle sign-out: <span className="font-semibold">{staffSecurity.idleMinutes} minutes</span></li>
            <li>Maximum session: <span className="font-semibold">{staffSecurity.maxHours} hours</span></li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-navy-400">
            <Lock className="h-3 w-3" aria-hidden /> Set in the server configuration for security.
          </p>
        </Panel>
      </div>

      <Panel title="Follow-up rules" icon={<ListChecks className="h-4 w-4" aria-hidden />} className="mt-6" action={edit('followUps')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-navy-500">
              <tr className="border-b border-navy-100">
                <th className="py-3 pr-4 font-semibold">When this happens</th>
                <th className="px-4 py-3 font-semibold">Staff must</th>
                <th className="px-4 py-3 font-semibold">Within</th>
                <th className="px-4 py-3 font-semibold">If missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {settings.followUpRules.map((r) => (
                <tr key={r.trigger}>
                  <td className="py-3.5 pr-4 font-medium text-navy-900">{r.trigger}</td>
                  <td className="px-4 py-3.5 text-navy-700">{r.action}</td>
                  <td className="px-4 py-3.5 font-semibold text-navy-900">{r.limit}</td>
                  <td className="px-4 py-3.5 text-navy-600">{r.escalation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {settings.demoTools && <Panel title="Demo data" icon={<RotateCcw className="h-4 w-4" aria-hidden />} className="mt-6">
        <p className="text-sm text-navy-600">Put leads, students, sessions, availability, time off and temporary access back to the original demo data. Logins are kept.</p>
        {done && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Demo data reset.</p>}
        <Button variant="outline" className="mt-4" onClick={() => setConfirm(true)}>Reset demo data</Button>
      </Panel>}

      {editing && (
        <EditModal
          section={editing}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setSaved(SECTION_TITLES[editing]);
            setEditing(null);
          }}
        />
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={reset} loading={resetting}>Reset</Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">All changes made to the demo data, by anyone, will be lost.</p>
      </Modal>
    </>
  );
}

const SECTION_TITLES: Record<Section, string> = { workingHours: 'Working hours', quietHours: 'Quiet hours', followUps: 'Follow-up time limits' };

/** One form for whichever section is being edited; each section is saved whole. */
function EditModal({ section, settings, onClose, onSaved }: { section: Section; settings: Settings; onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState<WorkingHours>({ days: settings.workingHours.days, start: settings.workingHours.start, end: settings.workingHours.end });
  const [quiet, setQuiet] = useState<QuietHours>(settings.quietHours);
  const limits = settings.followUpLimits;
  const [follow, setFollow] = useState({
    firstContactMinutes: String(limits.firstContactMinutes),
    firstContactNextDay: limits.firstContactNextDay,
    bookSessionHours: String(limits.bookSessionHours),
    planFollowUpHours: String(limits.planFollowUpHours),
    documentCheckWorkingDays: String(limits.documentCheckWorkingDays),
    deadlineReminderDays: limits.deadlineReminderDays.join(', '),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const body = () => {
    if (section === 'workingHours') return { workingHours: hours };
    if (section === 'quietHours') return { quietHours: quiet };
    const days = follow.deadlineReminderDays.split(/[\s,]+/).filter(Boolean).map(Number);
    return {
      followUps: {
        firstContactMinutes: Number(follow.firstContactMinutes),
        firstContactNextDay: follow.firstContactNextDay,
        bookSessionHours: Number(follow.bookSessionHours),
        planFollowUpHours: Number(follow.planFollowUpHours),
        documentCheckWorkingDays: Number(follow.documentCheckWorkingDays),
        deadlineReminderDays: days,
      },
    };
  };

  const save = async () => {
    setErrors({});
    setFormError(null);
    if (section === 'followUps' && follow.deadlineReminderDays.split(/[\s,]+/).filter(Boolean).some((d) => !/^\d+$/.test(d))) {
      setErrors({ deadlineReminderDays: 'Enter whole numbers of days, separated by commas (e.g. 14, 7, 2).' });
      return;
    }
    setSaving(true);
    try {
      // Refused changes show their message straight away; only a saved change reloads the portal's data.
      const updated = await api.put('/settings', body());
      await mutate(async () => updated, { silent: true });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  let content: ReactNode;
  if (section === 'workingHours') {
    const toggle = (d: number) => setHours((h) => ({ ...h, days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort() }));
    content = (
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-800">Working days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((label, d) => (
              <button
                key={label}
                type="button"
                onClick={() => toggle(d)}
                aria-pressed={hours.days.includes(d)}
                aria-label={DAY_NAMES[d]}
                className={cn(
                  'h-10 min-w-[3.25rem] rounded-full px-3 text-sm font-semibold ring-1 transition',
                  hours.days.includes(d) ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-600 ring-navy-200 hover:ring-navy-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.days && <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">Choose at least one working day.</p>}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Opens at (IST)" type="time" required value={hours.start} error={errors.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} />
          <TextField label="Closes at (IST)" type="time" required value={hours.end} error={errors.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} />
        </div>
        <p className="text-xs text-navy-500">Used for "working day" time limits and for when new enquiries must be answered.</p>
      </div>
    );
  } else if (section === 'quietHours') {
    content = (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Starts at" type="time" required value={quiet.start} error={errors.start} onChange={(e) => setQuiet({ ...quiet, start: e.target.value })} />
          <TextField label="Ends at" type="time" required value={quiet.end} error={errors.end} onChange={(e) => setQuiet({ ...quiet, end: e.target.value })} />
        </div>
        <p className="text-xs text-navy-500">Quiet hours can run past midnight (e.g. 21:00 to 08:00). Login codes and other urgent emails are always sent straight away.</p>
      </div>
    );
  } else {
    const set = (k: keyof typeof follow) => (e: { target: { value: string } }) => setFollow({ ...follow, [k]: e.target.value });
    content = (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="New enquiry, in working hours (minutes)" type="number" min={5} max={240} required value={follow.firstContactMinutes} error={errors.firstContactMinutes} onChange={set('firstContactMinutes')} />
          <TextField label="New enquiry, out of hours (by, next working day)" type="time" required value={follow.firstContactNextDay} error={errors.firstContactNextDay} onChange={set('firstContactNextDay')} />
          <TextField label="Contacted, no session booked (hours)" type="number" min={1} max={168} required value={follow.bookSessionHours} error={errors.bookSessionHours} onChange={set('bookSessionHours')} />
          <TextField label="Plan shared, not registered (hours)" type="number" min={1} max={168} required value={follow.planFollowUpHours} error={errors.planFollowUpHours} onChange={set('planFollowUpHours')} />
          <TextField label="Document uploaded (working days)" type="number" min={1} max={10} required value={follow.documentCheckWorkingDays} error={errors.documentCheckWorkingDays} onChange={set('documentCheckWorkingDays')} />
        </div>
        <TextField
          label="Deadline reminders (days before)"
          required
          value={follow.deadlineReminderDays}
          error={errors.deadlineReminderDays}
          hint="Separate with commas, e.g. 14, 7, 2. Managers are alerted on the last one."
          onChange={set('deadlineReminderDays')}
        />
        <p className="text-xs text-navy-500">The other rules in the table are fixed for now.</p>
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${SECTION_TITLES[section].toLowerCase()}`}
      size={section === 'followUps' ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} data-save-settings>Save</Button>
        </>
      }
    >
      {formError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}
      {content}
    </Modal>
  );
}
