import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  id: string;
  /** Shows a red asterisk after the label (and tells screen readers the field is required). */
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ label, error, hint, id, required, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-navy-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, error, hint, className, type = 'text', required, ...rest },
  ref,
) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <FieldShell label={label} error={error} hint={hint} id={id} required={required}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? 'text' : type}
          aria-invalid={!!error}
          aria-required={required || undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn('input', error && 'input-error', isPassword && 'pr-12', className)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-navy-400 hover:text-navy-800"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </FieldShell>
  );
});

interface ComboProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Suggestions shown as a dropdown while typing; any other value can still be typed. */
  options: string[];
}

/** A text field with a dropdown of suggestions (the browser's own list), for answers that aren't from a fixed set. */
export const ComboField = forwardRef<HTMLInputElement, ComboProps>(function ComboField({ options, ...rest }, ref) {
  const listId = useId();
  return (
    <>
      <TextField ref={ref} list={listId} autoComplete="off" {...rest} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, options, placeholder, className, required, ...rest },
  ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} id={id} required={required}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-required={required || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn('input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', error && 'input-error', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237894BC' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...(rest.value === undefined && rest.defaultValue === undefined ? { defaultValue: '' } : {})}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});
