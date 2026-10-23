import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { VerifyCodeStep } from '../components/auth/VerifyCodeStep';
import { SelectField, TextField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { registerSchema, type RegisterForm } from '../lib/validation';
import { ApiError, type OtpRequestResult } from '../lib/api/types';

const destinationOptions = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'europe', label: 'Europe (Germany, Ireland, France)' },
  { value: 'undecided', label: 'Not sure yet' },
];

const intakeOptions = [
  { value: '2027-01', label: 'January 2027' },
  { value: '2027-09', label: 'September 2027' },
  { value: '2028-01', label: 'January 2028' },
  { value: '2028-09', label: 'September 2028' },
];

/** Free student registration: details, then confirm the email with a one-time code. */
export function RegisterPage() {
  const { register: registerStudent, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState<{ email: string; result: OtpRequestResult } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', mobile: '', destination: '', intake: '', consent: false },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const result = await registerStudent({ ...data, mobile: `+91${data.mobile}` });
      setSent({ email: data.email, result });
    } catch (err) {
      if (err instanceof ApiError) {
        Object.entries(err.fieldErrors).forEach(([field, message]) => setError(field as keyof RegisterForm, { message }));
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  });

  if (sent) {
    return (
      <AuthShell title="Confirm your email" subtitle="Enter the 6-digit code to finish creating your account.">
        <VerifyCodeStep
          email={sent.email}
          initial={sent.result}
          onVerify={async (code) => {
            await verifyOtp(sent.email, code);
            navigate('/dashboard', { replace: true, state: { welcome: true } });
          }}
          onResend={() => requestOtp(sent.email)}
          onBack={() => setSent(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your free account"
      subtitle={
        <>
          It takes under a minute, and there's no password to remember. Already registered?{' '}
          <Link to="/login" className="font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4 hover:text-gold-700">
            Log in
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
        <TextField label="Full name" autoComplete="name" placeholder="As on your passport" error={errors.name?.message} {...register('name')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98XXXXXXXX"
            hint="10-digit Indian mobile"
            error={errors.mobile?.message}
            {...register('mobile')}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Preferred destination" placeholder="Choose one" options={destinationOptions} error={errors.destination?.message} {...register('destination')} />
          <SelectField label="Preferred intake" placeholder="Choose one" options={intakeOptions} error={errors.intake?.message} {...register('intake')} />
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-navy-700">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded border-navy-300 accent-navy-900" aria-invalid={!!errors.consent} {...register('consent')} />
            <span>
              I agree to the <a href="#" className="font-medium text-navy-900 underline underline-offset-2">Terms of use</a> and{' '}
              <a href="#" className="font-medium text-navy-900 underline underline-offset-2">Privacy notice</a>, and I understand AHatIn may earn
              commission from universities through partner agencies, which will be disclosed to me.
            </span>
          </label>
          {errors.consent && <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.consent.message}</p>}
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" loading={isSubmitting}>
          Create my account <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </Button>
        <p className="text-center text-xs text-navy-400">Demo only: your details are stored in this browser and nowhere else.</p>
      </form>
    </AuthShell>
  );
}
