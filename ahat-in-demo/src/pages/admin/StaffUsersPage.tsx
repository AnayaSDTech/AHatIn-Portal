import { useState, type FormEvent } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useGrants } from '../../hooks/useStaffData';
import { Panel } from '../../components/dashboard/Panel';
import { counsellorName, counsellors, isGrantActive, type AccessGrant } from '../../data/staff';
import { isoDate } from '../../lib/scheduling';
import { useAuth } from '../../context/AuthContext';
import { useLocalState } from '../../hooks/useLocalState';
import { PageHeader } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SelectField, TextField } from '../../components/ui/FormField';
import { demoStaffUsers, type StaffRole, type StaffUser } from '../../data/staff';
import { formatDate, relativeTime } from '../../lib/utils';
import { uid } from '../../lib/crypto';

const roleLabel: Record<StaffRole, string> = { counsellor: 'Counsellor', officer: 'Application officer', admin: 'Administrator' };

export function StaffUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useLocalState('ahatin-demo-staff-users', demoStaffUsers);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'counsellor' as StaffRole });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<StaffUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [grants, setGrants] = useGrants();
  const [granting, setGranting] = useState(false);
  const [grantForm, setGrantForm] = useState({ granteeId: '', ownerId: '', until: '', reason: '' });
  const [grantErrors, setGrantErrors] = useState<Record<string, string>>({});
  const todayIso = isoDate(new Date());
  const maxIso = isoDate(new Date(Date.now() + 30 * 86_400_000));

  const grant = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!grantForm.granteeId) err.granteeId = 'Choose who gets access.';
    if (!grantForm.ownerId) err.ownerId = 'Choose whose students they can see.';
    else if (grantForm.ownerId === grantForm.granteeId) err.ownerId = 'Choose a different counsellor.';
    if (!grantForm.until) err.until = 'Choose an end date.';
    else if (grantForm.until < todayIso || grantForm.until > maxIso) err.until = 'End date must be within the next 30 days.';
    if (grantForm.reason.trim().length < 5) err.reason = 'Give a reason, e.g. annual leave.';
    setGrantErrors(err);
    if (Object.keys(err).length) return;
    const g: AccessGrant = { id: uid(), ...grantForm, reason: grantForm.reason.trim(), grantedBy: user?.name ?? 'Admin' };
    setGrants((all) => [...all, g]);
    setMessage(`${counsellorName(g.granteeId)} can see ${counsellorName(g.ownerId)}'s leads and students until ${formatDate(g.until)}. Access ends automatically.`);
    setGranting(false);
    setGrantForm({ granteeId: '', ownerId: '', until: '', reason: '' });
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter the full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) err.email = 'Enter a valid work email.';
    else if (users.some((u) => u.email === form.email.trim().toLowerCase())) err.email = 'A staff user with this email already exists.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setUsers((all) => [...all, { id: uid(), name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, status: 'active', lastLogin: '' }]);
    setMessage(`Demo: an invitation would be emailed to ${form.email.trim()}. They set a password and an authenticator app on first sign-in.`);
    setForm({ name: '', email: '', role: 'counsellor' });
    setAdding(false);
  };

  const toggle = (u: StaffUser) => {
    setUsers((all) => all.map((x): StaffUser => (x.id === u.id ? { ...x, status: x.status === 'active' ? 'deactivated' : 'active' } : x)));
    setMessage(u.status === 'active' ? `${u.name} was deactivated and signed out of all devices.` : `${u.name} was reactivated.`);
    setConfirm(null);
  };

  return (
    <>
      <PageHeader
        title="Staff users"
        description="Only administrators create staff accounts. There is no public staff registration."
        action={
          <Button variant="gold" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> Add staff user
          </Button>
        }
      />
      {message && <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-navy-50/60 text-xs uppercase tracking-wider text-navy-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Last sign-in</th>
              <th className="px-5 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {users.map((u) => {
              const self = u.email === user?.email;
              return (
                <tr key={u.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-navy-900">{u.name}{self && <span className="ml-2 text-xs font-normal text-navy-400">(you)</span>}</p>
                    <p className="text-xs text-navy-500">{u.email}</p>
                  </td>
                  <td className="px-5 py-4 text-navy-700">{roleLabel[u.role]}</td>
                  <td className="px-5 py-4"><Pill tone={u.status === 'active' ? 'green' : 'grey'}>{u.status === 'active' ? 'Active' : 'Deactivated'}</Pill></td>
                  <td className="px-5 py-4 text-navy-500">{u.lastLogin ? relativeTime(u.lastLogin) : 'Invited'}</td>
                  <td className="px-5 py-4 text-right">
                    {!self && (
                      <button
                        type="button"
                        onClick={() => setConfirm(u)}
                        className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-navy-900"
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Panel
        title="Temporary access (cover)"
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        className="mt-6"
        action={<Button size="sm" variant="outline" onClick={() => setGranting(true)}>Grant access</Button>}
      >
        <p className="mb-4 text-sm text-navy-600">Lets a counsellor see another counsellor's leads and students for a set period, for example during leave. It ends automatically.</p>
        {grants.length === 0 ? (
          <p className="text-sm text-navy-400">No temporary access granted.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {[...grants].reverse().map((g) => {
              const active = isGrantActive(g);
              return (
                <li key={g.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-semibold text-navy-900">
                      {counsellorName(g.granteeId)} → {counsellorName(g.ownerId)}'s students
                    </p>
                    <p className="text-xs text-navy-500">
                      Until {formatDate(g.until)} · {g.reason} · granted by {g.grantedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={active ? 'green' : 'grey'}>{g.revoked ? 'Revoked' : active ? 'Active' : 'Ended'}</Pill>
                    {active && (
                      <button
                        type="button"
                        onClick={() => {
                          setGrants((all) => all.map((x) => (x.id === g.id ? { ...x, revoked: true } : x)));
                          setMessage(`Access for ${counsellorName(g.granteeId)} revoked.`);
                        }}
                        className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-navy-900"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={granting}
        onClose={() => setGranting(false)}
        title="Grant temporary access"
        footer={
          <>
            <Button variant="outline" onClick={() => setGranting(false)}>Cancel</Button>
            <Button type="submit" form="grant-form">Grant access</Button>
          </>
        }
      >
        <form id="grant-form" onSubmit={grant} noValidate className="space-y-4">
          <SelectField label="Counsellor who gets access" placeholder="Choose" options={counsellors.map((c) => ({ value: c.id, label: c.name }))} value={grantForm.granteeId} onChange={(e) => setGrantForm({ ...grantForm, granteeId: e.target.value })} error={grantErrors.granteeId} />
          <SelectField label="Whose students they can see" placeholder="Choose" options={counsellors.map((c) => ({ value: c.id, label: c.name }))} value={grantForm.ownerId} onChange={(e) => setGrantForm({ ...grantForm, ownerId: e.target.value })} error={grantErrors.ownerId} />
          <TextField label="Until (inclusive)" type="date" min={todayIso} max={maxIso} value={grantForm.until} onChange={(e) => setGrantForm({ ...grantForm, until: e.target.value })} error={grantErrors.until} />
          <TextField label="Reason" placeholder="e.g. Rohan on annual leave" value={grantForm.reason} onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })} error={grantErrors.reason} />
        </form>
      </Modal>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add staff user"
        description="They'll receive an invitation to set a password and an authenticator app."
        footer={
          <>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" form="add-staff">Send invitation</Button>
          </>
        }
      >
        <form id="add-staff" onSubmit={add} noValidate className="space-y-4">
          <TextField label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <TextField label="Work email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <SelectField
            label="Role"
            options={(Object.keys(roleLabel) as StaffRole[]).map((r) => ({ value: r, label: roleLabel[r] }))}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
          />
        </form>
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.status === 'active' ? `Deactivate ${confirm?.name}?` : `Reactivate ${confirm?.name}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className={confirm?.status === 'active' ? 'bg-red-600 hover:bg-red-700' : undefined} onClick={() => confirm && toggle(confirm)}>
              {confirm?.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">
          {confirm?.status === 'active'
            ? 'They will be signed out of all devices within a minute and can no longer sign in. Their history is kept.'
            : 'They will be able to sign in again.'}
        </p>
      </Modal>
    </>
  );
}
