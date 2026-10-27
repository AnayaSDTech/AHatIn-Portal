import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, KeyRound, Lock, Smartphone } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { TextField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { OtpInput } from '../../components/auth/OtpInput';
import { homeFor } from '../../components/auth/RouteGuards';
import { DemoAuthenticator } from './StaffLoginPage';
import { api } from '../../lib/api/client';
import { ApiError, type Role, type User } from '../../lib/api/types';
import { showDemoHints } from '../../lib/demoAccounts';

interface Invite {
  name: string;
  email: string;
  role: Role;
  secret: string;
  otpauthUri: string;
}

const roleLabel: Record<string, string> = { counsellor: 'Counsellor', officer: 'Application officer', finance_officer: 'Financial Aid Officer', visa_officer: 'Visa Officer', admin: 'Administrator' };

/** First sign-in for a new staff member: choose a password and connect an authenticator app. */
export function StaffSetupPage() {
  const { token = '' } = useParams();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Invite>(`/auth/staff/invite/${token}`)
      .then(setInvite)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('Use at least 10 characters, with letters and numbers.');
    if (password !== confirm) return setError('The passwords don’t match.');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from your authenticator app.');
    setError(null);
    setSaving(true);
    try {
      const { user } = await api.post<{ user: User }>(`/auth/staff/invite/${token}`, { password, code });
      // A full page load picks up the new session.
      window.location.assign(homeFor(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setCode('');
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" aria-hidden />
      <header className="relative px-5 py-5 sm:px-8">
        <Logo light />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-7 shadow-lift sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-navy-600">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Staff only
          </span>
          <h1 className="mt-4 text-3xl">Set up your account</h1>

          {loadError ? (
            <>
              <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {loadError}
              </div>
              <Link to="/staff/login" className="mt-6 inline-block text-sm font-semibold text-navy-900 hover:text-gold-700">Go to staff sign in</Link>
            </>
          ) : !invite ? (
            <p className="mt-2 text-sm text-navy-600">Checking your invitation…</p>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 space-y-5">
              <p className="text-sm text-navy-600">
                {invite.name} · {invite.email} · <span className="font-semibold text-navy-800">{roleLabel[invite.role] ?? invite.role}</span>
              </p>
              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  {error}
                </div>
              )}
              <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers" value={password} onChange={(e) => setPassword(e.target.value)} />
              <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

              <div className="rounded-2xl bg-ivory p-4 text-sm text-navy-700">
                <p className="flex items-center gap-2 font-semibold text-navy-900">
                  <Smartphone className="h-4 w-4" aria-hidden /> Connect an authenticator app
                </p>
                <p className="mt-1">In Google Authenticator, Microsoft Authenticator or similar, add an account with this key:</p>
                <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wider ring-1 ring-navy-100">{invite.secret}</p>
                <a href={invite.otpauthUri} className="mt-2 inline-block text-xs font-semibold underline underline-offset-2">On your phone? Open it in your authenticator app</a>
              </div>
              {showDemoHints && <DemoAuthenticator secret={invite.secret} onUse={setCode} />}
              <OtpInput value={code} onChange={setCode} invalid={!!error} disabled={saving} label="Code from the app" />
              <Button type="submit" size="lg" className="w-full" loading={saving}>
                <KeyRound className="h-5 w-5" aria-hidden /> Finish and sign in
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
