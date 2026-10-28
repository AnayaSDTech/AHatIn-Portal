import { useState } from 'react';
import { Clock, ListChecks, Moon, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { PageHeader } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import type { FollowUpRule } from '../../data/staff';

interface Settings {
  workingHours: { days: string; start: string; end: string };
  quietHours: { start: string; end: string };
  staffSecurity: { twoStep: boolean; idleMinutes: number; maxHours: number };
  followUpRules: FollowUpRule[];
  /** Development only: the demo data can be reset. */
  demoTools: boolean;
}

export function SettingsPage() {
  const [settings] = useApi<Settings | null>('/settings', null);
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
  const { workingHours, quietHours, staffSecurity } = settings;
  return (
    <>
      <PageHeader title="Settings" description="Working hours, quiet hours, staff security and follow-up rules." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Working hours" icon={<Clock className="h-4 w-4" aria-hidden />}>
          <p className="text-sm text-navy-700">{workingHours.days}</p>
          <p className="font-display text-2xl text-navy-900">{workingHours.start} – {workingHours.end} IST</p>
          <p className="mt-2 text-xs text-navy-400">Follow-up time limits count only working hours where a rule says so.</p>
        </Panel>
        <Panel title="Quiet hours" icon={<Moon className="h-4 w-4" aria-hidden />}>
          <p className="font-display text-2xl text-navy-900">{quietHours.start} – {quietHours.end}</p>
          <p className="mt-2 text-xs text-navy-400">No non-urgent WhatsApp, SMS or push messages to students and parents.</p>
        </Panel>
        <Panel title="Staff security" icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
          <ul className="space-y-1.5 text-sm text-navy-700">
            <li>2-step verification: <span className="font-semibold">{staffSecurity.twoStep ? 'required' : 'optional'}</span></li>
            <li>Idle sign-out: <span className="font-semibold">{staffSecurity.idleMinutes} minutes</span></li>
            <li>Maximum session: <span className="font-semibold">{staffSecurity.maxHours} hours</span></li>
          </ul>
        </Panel>
      </div>

      <Panel title="Follow-up rules" icon={<ListChecks className="h-4 w-4" aria-hidden />} className="mt-6">
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
