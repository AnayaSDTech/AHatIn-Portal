import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { Button } from '../ui/Button';

/** Shows "new version available" and "ready to work offline" messages from the service worker. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  // The "ready offline" note is informational, so it hides itself after a few seconds.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[70] mx-auto flex max-w-md animate-fade-up items-center gap-4 rounded-2xl border border-navy-100 bg-white p-4 shadow-lift sm:left-auto"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-800">
        {needRefresh ? <RefreshCw className="h-5 w-5" aria-hidden /> : <WifiOff className="h-5 w-5" aria-hidden />}
      </span>
      <p className="flex-1 text-sm text-navy-800">
        {needRefresh ? 'A new version is available.' : 'The app is ready to work offline.'}
      </p>
      {needRefresh && (
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Refresh
        </Button>
      )}
      <button type="button" onClick={close} className="text-navy-400 hover:text-navy-800" aria-label="Dismiss">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
