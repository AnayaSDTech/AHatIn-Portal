import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { OtpInput } from './OtpInput';
import { DemoHint } from './DemoHint';
import { ApiError, type OtpRequestResult } from '../../lib/api/types';

interface Props {
  email: string;
  initial: OtpRequestResult;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<OtpRequestResult>;
  onBack: () => void;
  /** Shown above the code boxes, instead of the default "If an account exists…". */
  message?: ReactNode;
  /** Label of the submit button. */
  submitLabel?: string;
}

/** Enter the 6-digit code sent to the email (to verify the email when registering). */
export function VerifyCodeStep({ email, initial, onVerify, onResend, onBack, message, submitLabel = 'Verify and continue' }: Props) {
  const [code, setCode] = useState('');
  const [info, setInfo] = useState(initial);
  const [cooldown, setCooldown] = useState(initial.resendIn);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  // Submit automatically once all six digits are entered.
  useEffect(() => {
    if (code.length === 6 && !verifying) void verify();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to a completed code

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      const next = await onResend();
      setInfo(next);
      setCooldown(next.resendIn);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={verify} noValidate className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl bg-navy-50/70 p-4 text-sm text-navy-700">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy-500" aria-hidden />
        <p>
          {message ?? (
            <>
              If an account exists for <span className="font-semibold text-navy-900">{email}</span>, we've sent a 6-digit code.
            </>
          )}{' '}
          It expires in {Math.round(info.expiresIn / 60)} minutes.
        </p>
      </div>

      {(info.demoCode || info.demoNote) && (
        <DemoHint title="Demo: no email is really sent">
          {info.demoCode ? (
            <p>
              Your code is <span className="font-mono text-base font-bold tracking-[0.3em]">{info.demoCode}</span>
              <button type="button" onClick={() => setCode(info.demoCode!)} className="ml-3 font-semibold underline underline-offset-4">
                Fill it in
              </button>
            </p>
          ) : (
            <p>{info.demoNote}</p>
          )}
        </DemoHint>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <OtpInput value={code} onChange={setCode} invalid={!!error} disabled={verifying} />

      <Button type="submit" size="lg" className="w-full" loading={verifying}>
        {submitLabel}
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
  );
}
