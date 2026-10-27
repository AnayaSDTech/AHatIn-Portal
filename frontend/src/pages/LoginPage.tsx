import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Briefcase } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { VerifyCodeStep } from '../components/auth/VerifyCodeStep';
import { DemoHint } from '../components/auth/DemoHint';
import { homeFor } from '../components/auth/RouteGuards';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { emailSchema, type EmailForm } from '../lib/validation';
import { ApiError, type OtpRequestResult } from '../lib/api/types';
import { DEMO_ACCOUNTS, showDemoHints } from '../lib/demoAccounts';

/** Student and parent login: email, then a one-time code. No passwords. */
export function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [sent, setSent] = useState<{ email: string; result: OtpRequestResult } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      setSent({ email, result: await requestOtp(email) });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  return (
    <AuthShell
      title={sent ? 'Check your email' : 'Student login'}
      subtitle={
        sent ? (
          'Enter the 6-digit code to log in.'
        ) : (
          <>
            We'll email you a one-time code, so there's no password to remember. New here?{' '}
            <Link to="/register" className="font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4 hover:text-gold-700">
              Create a free account
            </Link>
          </>
        )
      }
    >
      {sent ? (
        <VerifyCodeStep
          email={sent.email}
          initial={sent.result}
          onVerify={async (code) => {
            const user = await verifyOtp(sent.email, code);
            // signedIn: the dashboard opens the profile form if the profile isn't complete yet.
            navigate(from && homeFor(user.role) === '/dashboard' ? from : homeFor(user.role), { replace: true, state: { signedIn: true } });
          }}
          onResend={() => requestOtp(sent.email)}
          onBack={() => setSent(null)}
        />
      ) : (
        <>
          {showDemoHints && <div className="mb-6">
            <DemoHint title="Try a demo student account">
              {[
                { account: DEMO_ACCOUNTS.student, note: 'Journey under way' },
                { account: DEMO_ACCOUNTS.freshStudent, note: 'Nothing started yet' },
              ].map(({ account, note }) => (
                <div key={account.email} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1">
                  <span className="min-w-0">
                    <span className="block break-all">{account.email}</span>
                    <span className="text-xs opacity-75">{note}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setValue('email', account.email, { shouldValidate: true })}
                    className="shrink-0 font-semibold underline underline-offset-4 hover:text-amber-700"
                  >
                    {account === DEMO_ACCOUNTS.student ? 'Fill in demo email' : 'Fill in'}
                  </button>
                </div>
              ))}
            </DemoHint>
          </div>}

          {formError && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {formError}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Send me a code <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Button>
          </form>

          <div className="mt-10 border-t border-navy-100 pt-6">
            <Link
              to="/staff/login"
              state={{ email: getValues('email') }}
              className="flex items-center justify-center gap-2 text-sm font-medium text-navy-500 transition hover:text-navy-900"
            >
              <Briefcase className="h-4 w-4" aria-hidden /> AHat staff? Staff sign in
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
