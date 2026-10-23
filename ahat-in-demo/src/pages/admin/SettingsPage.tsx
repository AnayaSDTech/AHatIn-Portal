import { useState } from 'react';
import { Clock, ListChecks, Moon, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { resetShared } from '../../lib/demoStore';
import { PageHeader } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import { followUpRules } from '../../data/staff';

export function SettingsPage() {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const reset = () => {
    resetShared();
    Object.keys(localStorage).filter((k) => k.startsWith('ahatin-demo-staff-')).forEach((k) => localStorage.removeItem(k));
    setConfirm(false);
    setDone(true);
  };
  return (
    <>
      <PageHeader title="Settings" description="Administrators can change these values without new code. Read-only in this demo." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Working hours" icon={<Clock className="h-4 w-4" aria-hidden />}>
          <p className="text-sm text-navy-700">Monday – Saturday</p>
          <p className="font-display text-2xl text-navy-900">10:00 – 19:00 IST</p>
          <p className="mt-2 text-xs text-navy-400">Follow-up time limits count only working hours where a rule says so.</p>
        </Panel>
        <Panel title="Quiet hours" icon={<Moon className="h-4 w-4" aria-hidden />}>
          <p className="font-display text-2xl text-navy-900">21:00 – 08:00</p>
          <p className="mt-2 text-xs text-navy-400">No non-urgent WhatsApp, SMS or push messages to students and parents.</p>
        </Panel>
        <Panel title="Staff security" icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
          <ul className="space-y-1.5 text-sm text-navy-700">
            <li>2-step verification: <span className="font-semibold">required</span></li>
            <li>Idle sign-out: <span className="font-semibold">30 minutes</span></li>
            <li>Maximum session: <span className="font-semibold">12 hours</span></li>
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
              {followUpRules.map((r) => (
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

      <Panel title="Demo data" icon={<RotateCcw className="h-4 w-4" aria-hidden />} className="mt-6">
        <p className="text-sm text-navy-600">Put leads, students, sessions, availability, time off and temporary access back to the original demo data. Logins are kept.</p>
        {done && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Demo data reset.</p>}
        <Button variant="outline" className="mt-4" onClick={() => setConfirm(true)}>Reset demo data</Button>
      </Panel>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={reset}>Reset</Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">All changes made in this browser to the shared demo data will be lost.</p>
      </Modal>
    </>
  );
}
