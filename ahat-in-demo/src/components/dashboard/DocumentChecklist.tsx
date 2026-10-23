import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileUp, FolderCheck, Upload } from 'lucide-react';
import type { DocStatus, demoDocuments } from '../../data/dashboard';
import { cn } from '../../lib/utils';
import { Panel, Pill } from './Panel';

const meta: Record<DocStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'grey'; icon: typeof CheckCircle2 }> = {
  verified: { label: 'Verified', tone: 'green', icon: CheckCircle2 },
  pending: { label: 'In review', tone: 'amber', icon: Clock },
  rejected: { label: 'Needs action', tone: 'red', icon: AlertTriangle },
  missing: { label: 'To upload', tone: 'grey', icon: FileUp },
};

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

type Filter = 'all' | 'action' | 'verified';

type Doc = (typeof demoDocuments)[number];

interface Props {
  documents: Doc[];
  onChange: Dispatch<SetStateAction<Doc[]>>;
}

export function DocumentChecklist({ documents: docs, onChange: setDocs }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const verified = docs.filter((d) => d.status === 'verified').length;
  const visible = docs.filter((d) =>
    filter === 'all' ? true : filter === 'verified' ? d.status === 'verified' : d.status === 'missing' || d.status === 'rejected',
  );

  const pick = (id: string) => {
    targetId.current = id;
    inputRef.current?.click();
  };

  const onFile = (file: File | undefined) => {
    const id = targetId.current;
    if (!file || !id) return;
    if (!ALLOWED.includes(file.type)) {
      setMessage({ tone: 'error', text: 'Please upload a PDF, JPG or PNG file.' });
    } else if (file.size > MAX_BYTES) {
      setMessage({ tone: 'error', text: 'Files must be 10 MB or smaller.' });
    } else {
      // Demo: no file leaves the browser. The real portal uploads to secure storage and scans for viruses.
      setDocs((all) => all.map((d) => (d.id === id ? { ...d, status: 'pending' as const, note: `Uploaded “${file.name}” · waiting for review` } : d)));
      setMessage({ tone: 'ok', text: `“${file.name}” uploaded (demo). Your counsellor will review it.` });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Panel
      id="documents"
      title="Document checklist"
      icon={<FolderCheck className="h-4 w-4" aria-hidden />}
      action={<span className="text-sm font-semibold text-navy-700">{verified}/{docs.length} verified</span>}
    >
      <div className="h-2 overflow-hidden rounded-full bg-navy-50">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${(verified / docs.length) * 100}%` }} />
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

      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      <ul className="mt-4 divide-y divide-navy-100">
        {visible.map((d) => {
          const m = meta[d.status];
          const Icon = m.icon;
          const canUpload = d.status === 'missing' || d.status === 'rejected';
          return (
            <li key={d.id} className="flex items-center gap-3 py-3.5">
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  d.status === 'verified' && 'text-emerald-500',
                  d.status === 'pending' && 'text-amber-500',
                  d.status === 'rejected' && 'text-red-500',
                  d.status === 'missing' && 'text-navy-300',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">{d.name}</p>
                {d.note && <p className="truncate text-xs text-navy-500">{d.note}</p>}
              </div>
              {canUpload ? (
                <button
                  type="button"
                  onClick={() => pick(d.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
                </button>
              ) : (
                <Pill tone={m.tone}>{m.label}</Pill>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="py-6 text-center text-sm text-navy-400">Nothing here. Well done!</li>}
      </ul>
    </Panel>
  );
}
