import { useState, type FormEvent } from 'react';
import { KeyRound, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { useGrants } from '../../hooks/useStaffData';
import { Panel } from '../../components/dashboard/Panel';
import { activeCounsellors, counsellorName, isGrantActive, staffRoleLabel } from '../../data/staff';
import { isoDate } from '../../lib/scheduling';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SelectField, TextField } from '../../components/ui/FormField';
import type { StaffRole, StaffUser } from '../../data/staff';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { formatDate, relativeTime } from '../../lib/utils';

const NO_USERS: StaffUser[] = [];
const roleLabel: Record<StaffRole, string> = { counsellor: 'Counsellor', officer: 'Application officer', finance_officer: 'Financial Aid Officer', visa_officer: 'Visa Officer', admin: 'Administrator' };

export function StaffUsersPage() {
  const { user } = useAuth();
  const [users] = useApi<StaffUser[]>('/admin/staff', NO_USERS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'counsellor' as StaffRole });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<StaffUser | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [grants] = useGrants();
  const [granting, setGranting] = useState(false);
  const [grantForm, setGrantForm] = useState({ granteeId: '', ownerId: '', until: '', reason: '' });
  const [grantErrors, setGrantErrors] = useState<Record<string, string>>({});
  const todayIso = isoDate(new Date());
  const maxIso = isoDate(new Date(Date.now() + 30 * 86_400_000));

  /** Sends a change; returns the result, or undefined after showing why it failed. */
  const send = async <T,>(request: () => Promise<T>, onError: (message: string, fields: Record<string, string>) => void) => {
    try {
      return await mutate(request, { silent: true });
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.', err instanceof ApiError ? err.fieldErrors : {});
      return undefined;
    }
  };

  const grant = async (e: FormEvent) => {
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
    const g = await send(
      () => api.post<{ granteeId: string; ownerId: string; until: string }>('/admin/access-grants', { ...grantForm, reason: grantForm.reason.trim() }),
      (message, fields) => setGrantErrors(Object.keys(fields).length ? fields : { reason: message }),
    );
    if (!g) return;
    setMessage(`${counsellorName(g.granteeId)} can see ${counsellorName(g.ownerId)}'s leads and students until ${formatDate(g.until)}. Access ends automatically.`);
    setGranting(false);
    setGrantForm({ granteeId: '', ownerId: '', until: '', reason: '' });
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter the full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) err.email = 'Enter a valid work email.';
    else if (users.some((u) => u.email === form.email.trim().toLowerCase())) err.email = 'A staff user with this email already exists.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const created = await send(
      () => api.post<{ demoInviteLink?: string }>('/admin/staff', { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role }),
      (message, fields) => setErrors(Object.keys(fields).length ? fields : { email: message }),
    );
    if (!created) return;
    setMessage(
      `An invitation was emailed to ${form.email.trim()}. They set a password and an authenticator app on first sign-in.${created.demoInviteLink ? ` (Development: ${created.demoInviteLink})` : ''}`,
    );
    setForm({ name: '', email: '', role: 'counsellor' });
    setAdding(false);
  };

  const toggle = async (u: StaffUser) => {
    const done = await send(() => api.post(`/admin/staff/${u.id}/${u.status === 'active' ? 'deactivate' : 'reactivate'}`), (message) => setMessage(message));
    if (!done) return setConfirm(null);
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
                  <td className="px-5 py-4">
                    <Pill tone={u.status !== 'active' ? 'grey' : u.invited ? 'amber' : 'green'}>{u.status !== 'active' ? 'Deactivated' : u.invited ? 'Invited' : 'Active'}</Pill>
                  </td>
                  <td className="px-5 py-4 text-navy-500">{u.lastLogin ? relativeTime(u.lastLogin) : 'Never'}</td>
                  <td className="space-x-2 whitespace-nowrap px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(u)}
                      className="inline-flex items-center gap-1 rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-navy-900"
                      data-edit-staff={u.email}
                    >
                      <Pencil className="h-3 w-3" aria-hidden /> Edit
                    </button>
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
                          void send(() => api.post(`/admin/access-grants/${g.id}/revoke`), (message) => setMessage(message)).then(
                            (ok) => ok && setMessage(`Access for ${counsellorName(g.granteeId)} revoked.`),
                          );
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
          <SelectField label="Counsellor who gets access" placeholder="Choose" options={activeCounsellors().map((c) => ({ value: c.id, label: c.name }))} value={grantForm.granteeId} onChange={(e) => setGrantForm({ ...grantForm, granteeId: e.target.value })} error={grantErrors.granteeId} />
          <SelectField label="Whose students they can see" placeholder="Choose" options={activeCounsellors().map((c) => ({ value: c.id, label: c.name }))} value={grantForm.ownerId} onChange={(e) => setGrantForm({ ...grantForm, ownerId: e.target.value })} error={grantErrors.ownerId} />
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

      {editing && <EditStaffModal key={editing.id} staff={editing} onClose={() => setEditing(null)} onDone={setMessage} />}

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

/* ------------------------------ Editing a staff member ------------------------------ */

/**
 * Name, email and phone, and a new password. Someone who never finished their invitation also gets an authenticator key
 * when their password is set, shown once here for the admin to pass on.
 */
function EditStaffModal({ staff, onClose, onDone }: { staff: StaffUser; onClose: () => void; onDone: (message: string) => void }) {
  const [form, setForm] = useState({ name: staff.name, email: staff.email, phone: staff.phone ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'details' | 'password' | null>(null);
  const [key, setKey] = useState<string | null>(null);

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter the full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) err.email = 'Enter a valid work email.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving('details');
    try {
      await mutate(() => api.put(`/admin/staff/${staff.id}`, { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() }), { silent: true });
      onDone(`${form.name.trim()}'s details were saved.`);
      onClose();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.fieldErrors).length ? err.fieldErrors : { email: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setSaving(null);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setPwError('Use at least 10 characters, with letters and numbers.');
    if (password !== password2) return setPwError("The two passwords don't match.");
    setPwError(null);
    setSaving('password');
    try {
      const r = await mutate(() => api.post<{ authenticatorKey?: string }>(`/admin/staff/${staff.id}/password`, { password }), { silent: true });
      setPassword('');
      setPassword2('');
      if (r.authenticatorKey) {
        setKey(r.authenticatorKey);
      } else {
        onDone(`${staff.name}'s password was changed. They have been signed out on their other devices; their authenticator app stays the same.`);
        onClose();
      }
    } catch (err) {
      setPwError(err instanceof ApiError ? (err.fieldErrors.password ?? err.message) : 'Something went wrong. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  if (key) {
    return (
      <Modal
        open
        onClose={() => {
          onDone(`${staff.name} can now sign in with the new password and the authenticator key you shared.`);
          onClose();
        }}
        title={`${staff.name} is ready to sign in`}
        description="Share the password and this authenticator key with them privately. The key is shown only once."
        footer={
          <Button
            onClick={() => {
              onDone(`${staff.name} can now sign in with the new password and the authenticator key you shared.`);
              onClose();
            }}
          >
            Done
          </Button>
        }
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-navy-700">
          <li>In an authenticator app (Google Authenticator, Microsoft Authenticator…), add an account using this key:</li>
        </ol>
        <p className="mt-3 break-all rounded-xl bg-ivory px-4 py-3 font-mono text-base tracking-wider text-navy-900 ring-1 ring-navy-100" data-authenticator-key>{key}</p>
        <ol start={2} className="mt-3 list-decimal space-y-2 pl-5 text-sm text-navy-700">
          <li>
            Sign in at <span className="font-semibold">Staff sign in</span> with <span className="font-semibold">{staff.email}</span>, the new password, and the 6-digit code from the app.
          </li>
        </ol>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} size="lg" title={`Edit ${staff.name}`} description={`${staffRoleLabel[staff.role] ?? staff.role}. The role can't be changed, because their students and tasks depend on it.`}>
      <form onSubmit={saveDetails} noValidate className="space-y-4" data-staff-details>
        <h3 className="text-sm font-semibold text-navy-900">Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <TextField label="Work email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} hint="Used to sign in" />
          <TextField label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} hint="Shown to their students" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving === 'details'}>
            Save details
          </Button>
        </div>
      </form>

      <form onSubmit={savePassword} noValidate className="mt-6 space-y-4 border-t border-navy-100 pt-6" data-staff-password>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <KeyRound className="h-4 w-4" aria-hidden /> Set a new password
          </h3>
          <p className="mt-1 text-xs text-navy-500">
            {staff.invited
              ? "They haven't finished their invitation yet. Setting a password also creates their authenticator key, which you'll see once to pass on."
              : 'They will be signed out on their other devices. Their authenticator app stays the same.'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 10 characters, with letters and numbers" />
          <TextField label="Repeat the password" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} error={pwError ?? undefined} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={saving === 'password'} disabled={!password}>
            Set password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
