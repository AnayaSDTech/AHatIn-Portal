import { useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Copy, Gift, MessageCircle, Send, UsersRound } from 'lucide-react';
import { Panel, Pill } from '../dashboard/Panel';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { formatDate } from '../../lib/utils';

type ReferralStatus = 'invited' | 'registered' | 'profile' | 'applied' | 'accepted';

interface Referral {
  id: string;
  name: string;
  relation: string;
  source: 'invite' | 'link';
  status: ReferralStatus;
  at: string;
  /** Who referred them (the admin's view). */
  referrer?: string;
  /** Development and demo addresses only, where the email can't arrive. */
  demoLink?: string;
}

interface Referrals {
  code: string;
  link: string;
  totals: { referred: number; registered: number; applied: number; accepted: number };
  items: Referral[];
}

const STATUS: Record<ReferralStatus, { label: string; tone: 'grey' | 'blue' | 'amber' | 'green' }> = {
  invited: { label: 'Invited', tone: 'grey' },
  registered: { label: 'Registered', tone: 'blue' },
  profile: { label: 'Profile complete', tone: 'blue' },
  applied: { label: 'Applied', tone: 'amber' },
  accepted: { label: 'Offer accepted', tone: 'green' },
};

const RELATIONS = ['Friend', 'Family', 'Colleague', 'Other'].map((r) => ({ value: r, label: r }));
const BLANK = { name: '', email: '', relation: 'Friend' };

/** Copying needs a secure page; on a plain http address the older way still works. */
async function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const box = document.createElement('textarea');
  box.value = text;
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  document.execCommand('copy');
  box.remove();
}

/** "Refer a Friend/Family": the person's link, an invitation by email, and how far each person has got. */
export function ReferralsPanel({ showReferrer = false }: { /** The admin sees everyone's referrals, and who made each. */ showReferrer?: boolean }) {
  const [data, loaded] = useApi<Referrals | null>('/referrals', null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; demoLink?: string } | null>(null);

  if (!loaded) return <p className="py-10 text-center text-sm text-navy-400">Loading…</p>;
  if (!data) return <p className="py-10 text-center text-sm text-navy-500">Referrals aren't available for your account.</p>;

  const share = `I've been getting free study abroad guidance from AHat. Create your account here: ${data.link}`;
  const copy = async () => {
    await copyText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSent(null);
    setSaving(true);
    try {
      const made = await mutate(() => api.post<Referral>('/referrals', form), { silent: true });
      setSent({ name: made.name, demoLink: made.demoLink });
      setForm(BLANK);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totals = [
    { label: 'Referred', value: data.totals.referred },
    { label: 'Registered', value: data.totals.registered },
    { label: 'Applied', value: data.totals.applied },
    { label: 'Offer accepted', value: data.totals.accepted },
  ];

  return (
    <div className="space-y-6" data-referrals>
      <div className="card grid grid-cols-2 gap-px overflow-hidden bg-navy-100 lg:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label} className="bg-white p-4 sm:p-5" data-referral-total={t.label}>
            <p className="text-xs font-medium text-navy-500">{t.label}</p>
            <p className="mt-2 font-display text-3xl leading-none text-navy-900">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your referral link" icon={<Gift className="h-4 w-4" aria-hidden />}>
          <p className="text-sm text-navy-600">Share this link. Anyone who registers through it is added to your list below.</p>
          <div className="mt-4 flex gap-2">
            <input readOnly aria-label="Your referral link" value={data.link} className="input min-w-0 flex-1 py-2 text-sm" onFocus={(e) => e.target.select()} data-referral-link />
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()} data-copy-link>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(share)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Share on WhatsApp
          </a>
        </Panel>

        <Panel title="Invite by email" icon={<Send className="h-4 w-4" aria-hidden />}>
          {sent && (
            <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                Invitation emailed to {sent.name}.
                {sent.demoLink && ' Demo address, so no email is sent.'}
              </span>
            </p>
          )}
          {formError && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <form onSubmit={submit} noValidate className="space-y-4" data-referral-form>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Their full name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <SelectField label="Who are they?" options={RELATIONS} value={form.relation} error={errors.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
            </div>
            <TextField label="Their email" type="email" required value={form.email} error={errors.email} hint="Please check they're happy to hear from us first" onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Button type="submit" size="sm" loading={saving}>
              Send invitation
            </Button>
          </form>
        </Panel>
      </div>

      <Panel title={showReferrer ? 'All referrals' : 'People you have referred'} icon={<UsersRound className="h-4 w-4" aria-hidden />}>
        {data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-400">No referrals yet.</p>
        ) : (
          <ul className="divide-y divide-navy-100" aria-label="Referrals">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3" data-referral={r.name}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-900">
                    {r.name}
                    {r.relation && <span className="font-normal text-navy-500"> · {r.relation}</span>}
                  </p>
                  <p className="text-xs text-navy-500">
                    {r.source === 'link' ? 'Used your link' : 'Invited'} on {formatDate(r.at)}
                    {showReferrer && r.referrer && ` · by ${r.referrer}`}
                  </p>
                </div>
                <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
