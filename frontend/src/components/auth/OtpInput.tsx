import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
}

/** Six separate digit boxes that behave like one field: typing advances, Backspace goes back, paste fills all. */
export function OtpInput({ value, onChange, length = 6, invalid, disabled, label = 'Verification code' }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, '');
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid}
          onPaste={onPaste}
          onKeyDown={(e) => onKeyDown(i, e)}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            if (raw.length > 1) {
              // Autofill or fast typing can put several digits in one box.
              onChange((digits.slice(0, i).join('') + raw).slice(0, length));
              refs.current[Math.min(i + raw.length, length - 1)]?.focus();
              return;
            }
            setAt(i, raw);
            if (raw && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={cn(
            'h-14 w-full min-w-0 rounded-xl border bg-white text-center font-display text-2xl text-navy-900 shadow-sm transition focus:outline-none focus:ring-4 sm:h-16',
            invalid ? 'border-red-400 focus:ring-red-100' : 'border-navy-100 focus:border-gold-500 focus:ring-gold-100',
          )}
        />
      ))}
    </div>
  );
}
