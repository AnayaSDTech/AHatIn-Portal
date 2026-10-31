import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { OtpInput } from '../components/auth/OtpInput';
import { DemoHint } from '../components/auth/DemoHint';
import { homeFor } from '../components/auth/RouteGuards';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { emailSchema, resetPasswordSchema, type EmailForm, type ResetPasswordForm } from '../lib/validation';
import { ApiError, type OtpRequestResult } from '../lib/api/types';

function ErrorBox({ children }: { children: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

/** Forgot password: the student's email, then the 6-digit code we email and a new password. Signs them in. */
export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const location = useLocation();
  const [sent, setSent] = useState<{ email: string; result: OtpRequestResult } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema), defaultValues: { email: (location.state as { email?: string } | null)?.email ?? '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      setSent({ email, result: await forgotPassword(email) });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  if (sent) return <ResetStep email={sent.email} initial={sent.result} onBack={() => setSent(null)} />;

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter the email you registered with. We'll send you a code to set a new password.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <ErrorBox>{formError}</ErrorBox>}
        <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send me a code <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-navy-500">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4 hover:text-gold-700">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

function ResetStep({ email, initial, onBack }: { email: string; initial: OtpRequestResult; onBack: () => void }) {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(initial);
  const [cooldown, setCooldown] = useState(initial.resendIn);
  const [formError, setFormError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { code: '', password: '', confirmPassword: '' } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = handleSubmit(async ({ code, password }) => {
    setFormError(null);
    try {
      const user = await resetPassword(email, code, password);
      navigate(homeFor(user.role), { replace: true, state: { signedIn: true } });
    } catch (err) {
      if (err instanceof ApiError) Object.entries(err.fieldErrors).forEach(([field, message]) => setError(field as keyof ResetPasswordForm, { message }));
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  const resend = async () => {
    setResending(true);
    setFormError(null);
    try {
      const next = await forgotPassword(email);
      setInfo(next);
      setCooldown(next.resendIn);
      setValue('code', '');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not send a new code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Enter the code from the email, then choose your new password.">
      <form onSubmit={onSubmit} noValidate className="space-y-6" data-reset-form>
        <div className="flex items-start gap-3 rounded-2xl bg-navy-50/70 p-4 text-sm text-navy-700">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy-500" aria-hidden />
          <p>
            If a student account exists for <span className="font-semibold text-navy-900">{email}</span>, we've sent a 6-digit code. It expires in{' '}
            {Math.round(info.expiresIn / 60)} minutes.
          </p>
        </div>

        {(info.demoCode || info.demoNote) && (
          <DemoHint title="Demo: no email is really sent">
            {info.demoCode ? (
              <p>
                Your code is <span className="font-mono text-base font-bold tracking-[0.3em]">{info.demoCode}</span>
                <button type="button" onClick={() => setValue('code', info.demoCode!, { shouldValidate: true })} className="ml-3 font-semibold underline underline-offset-4">
                  Fill it in
                </button>
              </p>
            ) : (
              <p>{info.demoNote}</p>
            )}
          </DemoHint>
        )}

        {formError && <ErrorBox>{formError}</ErrorBox>}

        <div>
          <p className="mb-2 text-sm font-medium text-navy-800">6-digit code</p>
          <Controller control={control} name="code" render={({ field }) => <OtpInput value={field.value} onChange={field.onChange} invalid={!!errors.code} disabled={isSubmitting} />} />
          {errors.code && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {errors.code.message}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with letters and numbers"
            error={errors.password?.message}
            {...register('password')}
          />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Set new password and log in
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-medium text-navy-600 hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="font-semibold text-navy-900 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-navy-300 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
