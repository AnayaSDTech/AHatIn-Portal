import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileUp, FolderCheck, Trash2, Upload } from 'lucide-react';
import type { DocCategory, DocState, StudentDocument } from '../../data/staff';
import { cn, relativeTime } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/api/types';

const meta: Record<DocState, { label: string; tone: 'green' | 'amber' | 'red' | 'grey'; icon: typeof CheckCircle2 }> = {
  verified: { label: 'Verified', tone: 'green', icon: CheckCircle2 },
  pending: { label: 'In review', tone: 'amber', icon: Clock },
  rejected: { label: 'Needs action', tone: 'red', icon: AlertTriangle },
  missing: { label: 'To upload', tone: 'grey', icon: FileUp },
};

export const categoryLabel: Record<DocCategory, string | null> = { general: null, funds: 'Proof of funds', visa: 'Visa' };

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
/** Each document must be 50 KB to 200 KB (the server checks the same). */
const MIN_BYTES = 50 * 1024;
const MAX_BYTES = 200 * 1024;

type Filter = 'all' | 'action' | 'verified';

interface Props {
  documents: StudentDocument[];
  /** Uploads the file; rejects with the reason if it can't be accepted. */
  onUpload: (docId: string, file: File) => Promise<unknown>;
  /** Take back a file that is still waiting for review. */
  onRemove: (docId: string, name: string) => void;
}

export function DocumentChecklist({ documents: docs, onUpload, onRemove }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<StudentDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const verified = docs.filter((d) => d.state === 'verified').length;
  const visible = docs.filter((d) => (filter === 'all' ? true : filter === 'verified' ? d.state === 'verified' : d.state === 'missing' || d.state === 'rejected'));

  const pick = (id: string) => {
    targetId.current = id;
    inputRef.current?.click();
  };

  const onFile = (file: File | undefined) => {
    const id = targetId.current;
    if (!file || !id) return;
    if (!ALLOWED.includes(file.type)) {
      setMessage({ tone: 'error', text: 'Please upload a PDF, JPG or PNG file.' });
    } else if (file.size < MIN_BYTES || file.size > MAX_BYTES) {
      setMessage({
        tone: 'error',
        text: `Files must be between 50 KB and 200 KB. “${file.name}” is ${Math.round(file.size / 1024)} KB${file.size > MAX_BYTES ? ': try compressing it or scanning at a lower resolution.' : '.'}`,
      });
    } else {
      // Uploaded to secure storage and checked (file type and virus scan) before the counsellor sees it.
      setMessage({ tone: 'ok', text: `Uploading “${file.name}”…` });
      onUpload(id, file)
        .then(() => setMessage({ tone: 'ok', text: `“${file.name}” uploaded. We'll check it within 1 working day.` }))
        .catch((err) => setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'The upload failed. Please try again.' }));
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Panel id="documents" title="Document checklist" icon={<FolderCheck className="h-4 w-4" aria-hidden />} action={<span className="text-sm font-semibold text-navy-700">{verified}/{docs.length} verified</span>}>
      <div className="h-2 overflow-hidden rounded-full bg-navy-50">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${docs.length ? (verified / docs.length) * 100 : 0}%` }} />
      </div>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Filter documents">
        {(
          [
            ['all', 'All'],
            ['action', 'Needs action'],
            ['verified', 'Verified'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', filter === key ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100')}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p role="status" className={cn('mt-4 rounded-xl px-4 py-3 text-sm', message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
          {message.text}
        </p>
      )}

      <p className="mt-4 text-xs text-navy-500">PDF, JPG or PNG · 50–200 KB</p>

      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      <ul className="mt-4 divide-y divide-navy-100">
        {visible.map((d) => {
          const m = meta[d.state];
          const Icon = m.icon;
          const canUpload = d.state === 'missing' || d.state === 'rejected';
          const note = d.state === 'rejected' ? d.reason : d.state === 'pending' ? `${d.fileName ? `“${d.fileName}” · ` : ''}uploaded ${d.uploadedAt ? relativeTime(d.uploadedAt) : ''}` : undefined;
          const tag = categoryLabel[d.category];
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5" data-doc={d.name}>
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  d.state === 'verified' && 'text-emerald-500',
                  d.state === 'pending' && 'text-amber-500',
                  d.state === 'rejected' && 'text-red-500',
                  d.state === 'missing' && 'text-navy-300',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">
                  {d.name}
                  {tag && <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">{tag}</span>}
                </p>
                {note && <p className={cn('truncate text-xs', d.state === 'rejected' ? 'text-red-600' : 'text-navy-500')}>{note}</p>}
              </div>
              {canUpload ? (
                <button
                  type="button"
                  onClick={() => pick(d.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden /> {d.state === 'rejected' ? 'Re-upload' : 'Upload'}
                </button>
              ) : d.state === 'pending' ? (
                // Still waiting for review: the student can take back the file and upload the right one.
                <div className="flex shrink-0 items-center gap-1">
                  <Pill tone={m.tone}>{m.label}</Pill>
                  <button
                    type="button"
                    onClick={() => setRemoving(d)}
                    className="grid h-7 w-7 place-items-center rounded-full text-navy-300 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${d.name}`}
                    title="Remove this file"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <span className="shrink-0" title="Verified documents can't be changed. Ask your counsellor if something is wrong.">
                  <Pill tone={m.tone}>{m.label}</Pill>
                </span>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="py-6 text-center text-sm text-navy-400">{docs.length ? 'Nothing here' : 'No documents requested yet'}</li>}
      </ul>
      <p className="mt-4 text-xs text-navy-400">Wrong file? Remove it before it's checked. Verified documents are locked.</p>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this file?"
        description={removing ? `${removing.name}${removing.fileName ? ` · ${removing.fileName}` : ''}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!removing) return;
                onRemove(removing.id, removing.name);
                setMessage({ tone: 'ok', text: `File removed. ${removing.name} is back on your list to upload.` });
                setRemoving(null);
              }}
            >
              Remove file
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">Your counsellor won't review it. You can upload the right file at any time.</p>
      </Modal>
    </Panel>
  );
}
