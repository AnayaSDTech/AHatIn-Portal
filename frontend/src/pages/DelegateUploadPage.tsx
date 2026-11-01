import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileUp, ShieldCheck, Upload } from 'lucide-react';
import { uploadProblem } from '../components/dashboard/DocumentChecklist';
import { Container } from '../components/ui/Container';
import { uploadFile } from '../hooks/useJourney';
import { api } from '../lib/api/client';
import { ApiError } from '../lib/api/types';
import { cn, formatDate } from '../lib/utils';

interface Access {
  studentName: string;
  name: string;
  expiresAt: string;
  documents: { id: string; name: string; state: 'missing' | 'rejected'; reason?: string }[];
}

/** The page a parent or sponsor opens from their private link: upload what's still needed, and nothing else. */
export function DelegateUploadPage() {
  const { token = '' } = useParams();
  const base = `/delegate-access/${encodeURIComponent(token)}`;
  const [access, setAccess] = useState<Access | null>(null);
  const [dead, setDead] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<Access['documents'][number] | null>(null);

  const load = useCallback(
    () =>
      api
        .get<Access>(base)
        .then(setAccess)
        .catch((err) => setDead(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')),
    [base],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | undefined) => {
    const doc = target.current;
    if (input.current) input.current.value = '';
    if (!file || !doc) return;
    const problem = uploadProblem(file);
    if (problem) return setMessage({ tone: 'error', text: problem });
    setBusy(doc.id);
    setMessage({ tone: 'ok', text: `Uploading “${file.name}”…` });
    try {
      await uploadFile(`${base}/documents/${doc.id}`, file);
      setDone((d) => [...d, doc.name]);
      setMessage({ tone: 'ok', text: `${doc.name} uploaded. Thank you.` });
      await load();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'The upload failed. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[70vh] bg-[#F4F1EA] pb-20 pt-28">
      <Container>
        <div className="mx-auto max-w-2xl">
          {dead ? (
            <div className="card p-8 text-center" data-delegate-dead>
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
              <h1 className="mt-3 text-2xl">This link isn't working</h1>
              <p className="mt-2 text-sm text-navy-600">{dead}</p>
            </div>
          ) : !access ? (
            <p className="py-16 text-center text-sm text-navy-500">Loading…</p>
          ) : (
            <div className="card p-6 sm:p-8">
              <h1 className="text-2xl sm:text-3xl">Upload documents for {access.studentName}</h1>
              <p className="mt-2 text-sm text-navy-600">Hello {access.name.split(' ')[0]}. {access.studentName} asked you to upload these documents. Their AHat team checks each one.</p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-ivory px-3.5 py-2.5 text-xs text-navy-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-500" aria-hidden />
                This private link only lets you upload. It works until {formatDate(access.expiresAt)}. Please don't share it.
              </p>

              {message && (
                <p role="status" className={cn('mt-4 rounded-xl px-4 py-3 text-sm', message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
                  {message.text}
                </p>
              )}

              <p className="mt-5 text-xs text-navy-500">PDF, JPG or PNG · Maximum file size: 300 KB</p>
              <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

              {access.documents.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-delegate-all-done>
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Nothing left to upload right now.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-navy-100" aria-label="Documents to upload">
                  {access.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3.5" data-delegate-doc={d.name}>
                      {d.state === 'rejected' ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden /> : <FileUp className="h-5 w-5 shrink-0 text-navy-300" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-900">{d.name}</p>
                        {d.reason && <p className="text-xs text-red-600">{d.reason}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => {
                          target.current = d;
                          input.current?.click();
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden /> {busy === d.id ? 'Uploading…' : d.state === 'rejected' ? 'Re-upload' : 'Upload'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {done.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-navy-100 pt-4 text-sm text-navy-600" aria-label="Uploaded just now">
                  {done.map((name) => (
                    <li key={name} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden /> {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
