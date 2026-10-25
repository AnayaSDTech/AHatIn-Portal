import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, KeyRound, Lock, Smartphone } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { TextField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { OtpInput } from '../../components/auth/OtpInput';
import { DemoHint } from '../../components/auth/DemoHint';
import { homeFor } from '../../components/auth/RouteGuards';
import { useAuth } from '../../context/AuthContext';
import { staffLoginSchema, type StaffLoginForm } from '../../lib/validation';
import { ApiError, type StaffChallenge } from '../../lib/api/types';
import { DEMO_ACCOUNTS, totpCode } from '../../lib/api/mockAuth';

/** DEMO: shows what the staff member's authenticator app would display, refreshing every 30 seconds. */
function DemoAuthenticator({ secret, onUse }: { secret: string; onUse: (code: string) => void }) {
  const [code, setCode] = useState('------');
  const [left, setLeft] = useState(30);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const now = Date.now();
      const c = await totpCode(secret, now);
      if (alive) {
        setCode(c);
        setLeft(30 - Math.floor((now / 1000) % 30));
      }
    };
    void tick();
    const t = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [secret]);

  return (
    <DemoHint title="Demo authenticator app">
      <div className="mt-1 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold tracking-[0.3em]">{code}</p>
          <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-amber-200">
            <div className="h-full bg-amber-600 transition-all duration-1000 ease-linear" style={{ width: `${(left / 30) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs">New code in {left}s</p>
        </div>
        <button type="button" onClick={() => onUse(code)} className="font-semibold underline underline-offset-4">
          Fill it in
        </button>
      </div>
    </DemoHint>
  );
}

export function StaffLoginPage() {
  const { staffLogin, staffVerify } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; email?: string } | null;
  const [challenge, setChallenge] = useState<StaffChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginForm>({ resolver: zodResolver(staffLoginSchema), defaultValues: { email: state?.email ?? '', password: '' } });

  const fill = (account: { email: string; password: string }) => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      setChallenge(await staffLogin(email, password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from your authenticator app.');
    setError(null);
    setVerifying(true);
    try {
      const user = await staffVerify(challenge.challengeId, code);
      const home = homeFor(user.role);
      navigate(state?.from?.startsWith(home) ? state.from : home, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setCode('');
      if (err instanceof ApiError && err.status !== 400) setChallenge(null);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (code.length === 6 && !verifying) void verify();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to a completed code

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
          <h1 className="mt-4 text-3xl">{challenge ? '2-step verification' : 'Staff sign in'}</h1>
          <p className="mt-2 text-sm text-navy-600">
            {challenge
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'For AHat counsellors, officers and administrators. Accounts are created by an administrator.'}
          </p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {error}
            </div>
          )}

          {!challenge ? (
            <>
              <div className="mt-6">
                <DemoHint title="Demo staff accounts">
                  {[DEMO_ACCOUNTS.counsellor, DEMO_ACCOUNTS.admin].map((a) => (
                    <p key={a.email} className="flex flex-wrap items-center justify-between gap-x-3">
                      <span className="break-all">
                        <span className="font-semibold">{a.label}:</span> {a.email} · {a.password}
                      </span>
                      <button type="button" onClick={() => fill(a)} className="font-semibold underline underline-offset-4">
                        Use
                      </button>
                    </p>
                  ))}
                </DemoHint>
              </div>
              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                <TextField
                  label="Work email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@ahatin…"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
                <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                  <KeyRound className="h-5 w-5" aria-hidden /> Continue
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={verify} noValidate className="mt-6 space-y-6">
              {challenge.demoSecret && <DemoAuthenticator secret={challenge.demoSecret} onUse={setCode} />}
              <div className="flex items-center gap-3 text-sm text-navy-500">
                <Smartphone className="h-5 w-5" aria-hidden /> Google Authenticator, Microsoft Authenticator or similar
              </div>
              <OtpInput value={code} onChange={setCode} invalid={!!error} disabled={verifying} label="Authenticator code" />
              <Button type="submit" size="lg" className="w-full" loading={verifying}>
                Verify and sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setCode('');
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </button>
            </form>
          )}

          <p className="mt-8 border-t border-navy-100 pt-5 text-center text-sm text-navy-500">
            Student or parent?{' '}
            <Link to="/login" className="font-semibold text-navy-900 hover:text-gold-700">
              Student login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
