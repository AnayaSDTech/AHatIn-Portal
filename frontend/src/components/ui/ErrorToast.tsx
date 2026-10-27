import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

/** Shows why a change couldn't be saved (e.g. someone else changed the same record first). */
export function ErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onError = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 8000);
    };
    window.addEventListener('ahat:error', onError);
    return () => {
      window.removeEventListener('ahat:error', onError);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-md animate-fade-up items-start gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-800 shadow-lift sm:inset-x-auto sm:right-6">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
      <p className="flex-1">{message}</p>
      <button type="button" onClick={() => setMessage(null)} className="text-red-700 hover:text-red-900" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
