import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Briefcase, Gift, GraduationCap } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { VerifyCodeStep } from '../components/auth/VerifyCodeStep';
import { homeFor } from '../components/auth/RouteGuards';
import { TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { studentLoginSchema, type StudentLoginForm } from '../lib/validation';
import { ApiError, type OtpRequestResult, type User } from '../lib/api/types';

/**
 * Student and parent login: email and password. An email that was never verified is verified with a code first.
 * `referrer`: the same login, worded for referrers. Either page takes anyone to their own home after login.
 */
export function LoginPage({ referrer = false }: { referrer?: boolean }) {
  const { login, verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string; email?: string } | null)?.from;
  const [unverified, setUnverified] = useState<{ email: string; result: OtpRequestResult } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentLoginForm>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { email: (location.state as { email?: string } | null)?.email ?? '', password: '' },
  });

  // Carried to "Forgot password" and "Staff sign in", so it needn't be typed again.
  const typedEmail = watch('email');

  // signedIn: the dashboard opens the profile form if the profile isn't complete yet.
  const goHome = (user: User) => {
    const home = homeFor(user.role);
    navigate(from && from.startsWith(home) ? from : home, { replace: true, state: { signedIn: true } });
  };

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const result = await login(email, password);
      if ('user' in result) goHome(result.user);
      else setUnverified({ email, result: result.verifyEmail });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  if (unverified) {
    return (
      <AuthShell title="Verify your email" subtitle="One last step before you log in.">
        <VerifyCodeStep
          email={unverified.email}
          initial={unverified.result}
          message={
            <>
              Your email isn't verified yet. We've sent a 6-digit code to <span className="font-semibold text-navy-900">{unverified.email}</span>.
            </>
          }
          onVerify={async (code) => goHome(await verifyEmail(unverified.email, code))}
          onResend={() => resendVerification(unverified.email)}
          onBack={() => setUnverified(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={referrer ? 'Referrer login' : 'Student login'}
      subtitle={
        <>
          Log in with your email and password. {referrer ? 'Not a referrer yet?' : 'New here?'}{' '}
          <Link to={referrer ? '/referrer/register' : '/register'} className="font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4 hover:text-gold-700">
            {referrer ? 'Become a referrer' : 'Create a free account'}
          </Link>
        </>
      }
    >
      {formError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {formError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <div>
          <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              state={{ email: typedEmail }}
              className="text-sm font-semibold text-navy-700 underline-offset-4 hover:text-navy-900 hover:underline"
              data-forgot-password
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Log in <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </Button>
      </form>

      <div className="mt-10 flex flex-col items-center gap-3 border-t border-navy-100 pt-6 text-sm font-medium text-navy-500">
        <Link
          to={referrer ? '/login' : '/referrer/login'}
          state={{ email: typedEmail }}
          className="flex items-center justify-center gap-2 transition hover:text-navy-900"
        >
          {referrer ? <GraduationCap className="h-4 w-4" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
          {referrer ? 'Studying abroad with us? Student login' : 'Referring someone? Referrer login'}
        </Link>
        <Link to="/staff/login" state={{ email: typedEmail }} className="flex items-center justify-center gap-2 transition hover:text-navy-900">
          <Briefcase className="h-4 w-4" aria-hidden /> AHat staff? Staff sign in
        </Link>
      </div>
    </AuthShell>
  );
}
