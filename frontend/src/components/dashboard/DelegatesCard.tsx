import { useState, type FormEvent } from 'react';
import { CheckCircle2, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { api } from '../../lib/api/client';
import { act, mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { formatDate } from '../../lib/utils';

interface Delegate {
  id: string;
  name: string;
  email: string;
  relation: string;
  at: string;
  expiresAt: string;
  expired: boolean;
  uploads: number;
  /** Development and demo addresses only, where the email can't arrive. */
  demoLink?: string;
}

const RELATIONS = ['Parent', 'Guardian', 'Sponsor', 'Other'].map((r) => ({ value: r, label: r }));
const NONE: Delegate[] = [];
const BLANK = { name: '', email: '', relation: 'Parent' };

/** Lets the student invite a parent or sponsor to upload documents for them, by a private link that only does that. */
export function DelegatesCard() {
  const [people] = useApi<Delegate[]>('/me/delegates', NONE);
  const [form, setForm] = useState(BLANK);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; demoLink?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const made = await mutate(() => api.post<Delegate>('/me/delegates', form), { silent: true });
      setSent({ name: made.name, demoLink: made.demoLink });
      setForm(BLANK);
      setAdding(false);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel id="delegates" title="Parents and sponsors" icon={<UsersRound className="h-4 w-4" aria-hidden />} className="mt-6">
      <p className="text-sm text-navy-600">
        Invite a parent, guardian or sponsor to upload documents for you, such as bank statements. They get a private link by email. They can only upload: they can't open your documents or see the rest of your account.
      </p>

      {sent && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            Invitation emailed to {sent.name}.
            {sent.demoLink && (
              <>
                {' '}
                Demo address, so no email is sent:{' '}
                <a href={sent.demoLink} className="font-semibold underline" data-delegate-link>
                  open their link
                </a>
                .
              </>
            )}
          </span>
        </p>
      )}

      {people.length > 0 && (
        <ul className="mt-4 divide-y divide-navy-100" aria-label="People you've invited">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3" data-delegate={p.email}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">
                  {p.name} <span className="font-normal text-navy-500">· {p.relation}</span>
                </p>
                <p className="truncate text-xs text-navy-500">
                  {p.email} · {p.uploads ? `${p.uploads} uploaded` : 'Nothing uploaded yet'}
                </p>
              </div>
              {p.expired ? <Pill tone="grey">Expired</Pill> : <span className="text-xs text-navy-400">Link works until {formatDate(p.expiresAt)}</span>}
              <button
                type="button"
                onClick={() => act(() => api.delete(`/me/delegates/${p.id}`))}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${p.name}`}
                title="Remove their access"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={submit} noValidate className="mt-4 rounded-xl border border-navy-100 p-4" data-delegate-form>
          {formError && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Their full name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Their email" type="email" required value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <SelectField label="Who are they?" options={RELATIONS} value={form.relation} error={errors.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Send invitation
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setAdding(true);
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50"
          data-invite-delegate
        >
          <UserPlus className="h-4 w-4" aria-hidden /> Invite someone
        </button>
      )}
    </Panel>
  );
}
