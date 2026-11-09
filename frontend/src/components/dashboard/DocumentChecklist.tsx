import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, FileUp, FolderCheck, Info, Lock, Trash2, Upload } from 'lucide-react';
import type { DocCategory, DocState, StudentDocument } from '../../data/staff';
import { cn, relativeTime } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/api/types';

const meta: Record<DocState, { label: string; tone: 'green' | 'amber' | 'red' | 'grey'; icon: typeof CheckCircle2; tile: string }> = {
  verified: { label: 'Verified', tone: 'green', icon: CheckCircle2, tile: 'bg-emerald-50 text-emerald-600' },
  pending: { label: 'In review', tone: 'amber', icon: Clock, tile: 'bg-amber-50 text-amber-600' },
  rejected: { label: 'Needs action', tone: 'red', icon: AlertTriangle, tile: 'bg-red-50 text-red-600' },
  missing: { label: 'To upload', tone: 'grey', icon: FileUp, tile: 'bg-navy-50 text-navy-500' },
};

export const categoryLabel: Record<DocCategory, string | null> = { general: null, funds: 'Proof of funds', visa: 'Visa' };
/** The groups on the checklist, in order. */
const GROUPS: { key: DocCategory; title: string }[] = [
  { key: 'general', title: 'Application documents' },
  { key: 'funds', title: 'Proof of funds' },
  { key: 'visa', title: 'Visa documents' },
];

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
/** Each document must be 1 KB to 300 KB (the server checks the same). */
const MIN_BYTES = 1024;
const MAX_BYTES = 300 * 1024;

/** Why a file can't be uploaded, if it can't. */
export function uploadProblem(file: File) {
  if (!ALLOWED.includes(file.type)) return 'Please upload a PDF, JPG or PNG file.';
  if (file.size < MIN_BYTES || file.size > MAX_BYTES) {
    return `Files must be between 1 KB and 300 KB. “${file.name}” is ${Math.round(file.size / 1024)} KB${file.size > MAX_BYTES ? ': try compressing it or scanning at a lower resolution.' : '.'}`;
  }
  return null;
}

type Filter = 'all' | 'action' | 'review' | 'verified';
const matches = (d: StudentDocument, f: Filter) =>
  f === 'all' ? true : f === 'verified' ? d.state === 'verified' : f === 'review' ? d.state === 'pending' : d.state === 'missing' || d.state === 'rejected';

interface Props {
  documents: StudentDocument[];
  /** Uploads the file; rejects with the reason if it can't be accepted. */
  onUpload: (docId: string, file: File) => Promise<unknown>;
  /** Take back a file that is still waiting for review. */
  onRemove: (docId: string, name: string) => void;
}

function FilterTile({ active, onClick, label, count, tone, icon }: { active: boolean; onClick: () => void; label: string; count: number; tone: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition', active ? 'border-navy-900 bg-white shadow-soft ring-1 ring-navy-900' : 'border-navy-100 bg-ivory/50 hover:border-navy-200 hover:bg-white')}
    >
      <span className={cn('hidden h-9 w-9 shrink-0 place-items-center rounded-lg sm:grid', tone)}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-2xl leading-none text-navy-900">{count}</span>
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-navy-500">{label}</span>
      </span>
    </button>
  );
}

export function DocumentChecklist({ documents: docs, onUpload, onRemove }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<StudentDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const count = (f: Filter) => docs.filter((d) => matches(d, f)).length;
  const verified = count('verified');
  const pct = docs.length ? Math.round((verified / docs.length) * 100) : 0;
  const visible = docs.filter((d) => matches(d, filter));

  const pick = (id: string) => {
    targetId.current = id;
    inputRef.current?.click();
  };

  const onFile = (file: File | undefined) => {
    const id = targetId.current;
    if (!file || !id) return;
    const problem = uploadProblem(file);
    if (problem) {
      setMessage({ tone: 'error', text: problem });
    } else {
      // Uploaded to secure storage and checked (file type and virus scan) before the counsellor sees it.
      setMessage({ tone: 'ok', text: `Uploading “${file.name}”…` });
      onUpload(id, file)
        .then(() => setMessage({ tone: 'ok', text: `“${file.name}” uploaded. We'll check it within 1 working day.` }))
        .catch((err) => setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'The upload failed. Please try again.' }));
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const row = (d: StudentDocument) => {
    const m = meta[d.state];
    const Icon = m.icon;
    const canUpload = d.state === 'missing' || d.state === 'rejected';
    const note = d.state === 'pending' ? `${d.fileName ? `“${d.fileName}” · ` : ''}uploaded ${d.uploadedBy ? `by ${d.uploadedBy} ` : ''}${d.uploadedAt ? relativeTime(d.uploadedAt) : ''}` : undefined;
    return (
      <li
        key={d.id}
        className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3', d.state === 'rejected' ? 'border-red-200 bg-red-50/40' : 'border-navy-100 bg-white')}
        data-doc={d.name}
      >
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', m.tile)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-900">{d.name}</p>
          {d.state === 'rejected' && d.reason ? (
            <p className="mt-0.5 text-xs text-red-700">
              <span className="font-semibold">Why it was returned:</span> {d.reason}
            </p>
          ) : note ? (
            <p className="mt-0.5 truncate text-xs text-navy-500">{note}</p>
          ) : (
            <p className="mt-0.5 text-xs text-navy-400">{d.state === 'verified' ? 'Checked and accepted' : 'Not uploaded yet'}</p>
          )}
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
          {canUpload ? (
            <>
              {d.state === 'rejected' && <Pill tone="red">Needs action</Pill>}
              <button
                type="button"
                onClick={() => pick(d.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-sm transition',
                  d.state === 'rejected' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-navy-900 text-white hover:bg-navy-700',
                )}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden /> {d.state === 'rejected' ? 'Re-upload' : 'Upload'}
              </button>
            </>
          ) : d.state === 'pending' ? (
            // Still waiting for review: the student can take back the file and upload the right one.
            <>
              <Pill tone={m.tone}>{m.label}</Pill>
              <button
                type="button"
                onClick={() => setRemoving(d)}
                className="grid h-8 w-8 place-items-center rounded-full text-navy-300 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${d.name}`}
                title="Remove this file"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5" title="Verified documents can't be changed. Ask your counsellor if something is wrong.">
              <Pill tone={m.tone}>{m.label}</Pill>
              <Lock className="h-3.5 w-3.5 text-navy-300" aria-hidden />
            </span>
          )}
        </div>
      </li>
    );
  };

  const groups = GROUPS.map((g) => ({ ...g, docs: visible.filter((d) => d.category === g.key) })).filter((g) => g.docs.length);
  const showGroupTitles = new Set(docs.map((d) => d.category)).size > 1;

  return (
    <Panel
      id="documents"
      title="Document checklist"
      icon={<FolderCheck className="h-4 w-4" aria-hidden />}
      action={docs.length ? <Pill tone={verified === docs.length ? 'green' : 'blue'}>{verified} of {docs.length} verified</Pill> : undefined}
    >
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-ivory/50 px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-navy-400 shadow-sm">
            <FileText className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 font-semibold text-navy-900">No documents requested yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">When your counsellor or officers need a document from you, it appears here with an Upload button.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Filter documents">
            <FilterTile active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={docs.length} tone="bg-navy-50 text-navy-600" icon={<FileText className="h-4 w-4" aria-hidden />} />
            <FilterTile active={filter === 'action'} onClick={() => setFilter('action')} label="Needs action" count={count('action')} tone="bg-red-50 text-red-600" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} />
            <FilterTile active={filter === 'review'} onClick={() => setFilter('review')} label="In review" count={count('review')} tone="bg-amber-50 text-amber-600" icon={<Clock className="h-4 w-4" aria-hidden />} />
            <FilterTile active={filter === 'verified'} onClick={() => setFilter('verified')} label="Verified" count={verified} tone="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Documents verified">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold text-navy-700">{pct}%</span>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-ivory px-4 py-3 text-xs text-navy-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" aria-hidden />
            <span>
              PDF, JPG or PNG, up to 300 KB each. We check every upload within 1 working day. Wrong file? Remove it before it's checked; verified documents are locked.
            </span>
          </p>

          {message && (
            <p role="status" className={cn('mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm', message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
              {message.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              {message.text}
            </p>
          )}

          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

          {visible.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-navy-200 px-4 py-8 text-center text-sm text-navy-500">
              {filter === 'action' ? 'Nothing needs your action. Well done!' : filter === 'review' ? 'Nothing is waiting for review.' : 'No verified documents yet.'}
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {groups.map((g) => (
                <section key={g.key} aria-label={g.title}>
                  {showGroupTitles && (
                    <h3 className="mb-2 flex items-center justify-between font-sans text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                      {g.title}
                      <span className="font-medium normal-case tracking-normal text-navy-400">
                        {g.docs.filter((d) => d.state === 'verified').length} of {g.docs.length} verified
                      </span>
                    </h3>
                  )}
                  <ul className="space-y-2">{g.docs.map(row)}</ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

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
