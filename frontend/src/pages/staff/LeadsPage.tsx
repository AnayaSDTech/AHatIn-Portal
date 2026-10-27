import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useLeads, useStaffScope } from '../../hooks/useStaffData';
import { api } from '../../lib/api/client';
import { mutate } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { EmptyState, FilterChips, PageHeader, SearchBox } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/FormField';
import { STAGES, activeCounsellors, counsellorName, counsellors, stageIndex, stageLabel, type Lead, type StageKey } from '../../data/staff';
import { cn, formatDateTime, relativeTime } from '../../lib/utils';

const LEAD_STAGES = STAGES.slice(0, 4); // New lead → Assessed / plan shared
type StageFilter = 'all' | StageKey;

const stageTone = (key: string) => (key === 'new_lead' ? 'blue' : key === 'assessed' ? 'gold' : 'grey') as 'blue' | 'gold' | 'grey';

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2" title={`Readiness score ${score}/100`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-100">
        <div className={cn('h-full rounded-full', score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-400' : 'bg-navy-300')} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-navy-600">{score}</span>
    </div>
  );
}

function LeadDetails({ lead, onClose, isAdmin }: { lead: Lead; onClose: () => void; isAdmin: boolean }) {
  const [newOwner, setNewOwner] = useState('');
  const [ownerReason, setOwnerReason] = useState('');
  const [channel, setChannel] = useState('Call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<string>(lead.stage);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const movingBack = stageIndex(stage) < stageIndex(lead.stage);

  /** Sends a change; on failure shows the reason and returns undefined. */
  const send = async <T,>(request: () => Promise<T>) => {
    setError(null);
    try {
      return await mutate(request, { silent: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      return undefined;
    }
  };

  const logContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!outcome) return setError('Choose an outcome.');
    // Reaching a new lead moves it to "Contacted" automatically.
    const next = await send(() => api.post<Lead>(`/leads/${lead.id}/contacts`, { channel, outcome, notes: notes.trim() || null }));
    if (!next) return;
    setStage(next.stage);
    setOutcome('');
    setNotes('');
    const failed = next.activities.filter((a) => a.outcome === 'No answer').length;
    setMessage(failed >= 3 ? 'Contact logged. 3 unanswered attempts: consider moving this lead to Nurture.' : 'Contact logged.');
  };

  const saveStage = async () => {
    if (stage === lead.stage) return;
    if (movingBack && reason.trim().length < 5) return setError('Give a reason for moving the lead back a stage.');
    if (!(await send(() => api.post<Lead>(`/leads/${lead.id}/stage`, { stage, reason: movingBack ? reason.trim() : null })))) return;
    setReason('');
    setMessage(`Stage updated to ${stageLabel(stage)}.`);
  };

  const reassign = async () => {
    if (!newOwner) return setError('Choose the counsellor.');
    if (ownerReason.trim().length < 5) return setError(lead.counsellorId ? 'Give a reason for reassigning.' : 'Give a reason for assigning.');
    if (!(await send(() => api.post<Lead>(`/leads/${lead.id}/reassign`, { counsellorId: newOwner, reason: ownerReason.trim() })))) return;
    setMessage(`Lead ${lead.counsellorId ? 'reassigned' : 'assigned'} to ${counsellorName(newOwner)}.`);
    setNewOwner('');
    setOwnerReason('');
  };

  return (
    <Modal open onClose={onClose} size="lg" title={lead.name} description={lead.interest}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-navy-600">
          <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" aria-hidden /> {lead.email}</span>
          <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden /> {lead.mobile}</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {lead.city}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Pill tone={stageTone(lead.stage)}>{stageLabel(lead.stage)}</Pill>
          <span className="text-navy-500">Source: <span className="font-medium text-navy-800">{lead.source}</span> (can't be changed)</span>
          <span className="text-navy-500">Enquired {relativeTime(lead.createdAt)}</span>
          <span className="text-navy-500">
            Handled by: <span className="font-medium text-navy-800">{lead.counsellorId ? counsellorName(lead.counsellorId) : 'Admin'}</span>
          </span>
        </div>

        {(lead.message || lead.callTime) && (
          <div className="rounded-2xl bg-ivory px-4 py-3 text-sm">
            <p className="font-semibold text-navy-900">From the website enquiry</p>
            {lead.message && <p className="mt-1 whitespace-pre-line text-navy-700">“{lead.message}”</p>}
            {lead.callTime && <p className="mt-1 text-navy-500">Best time to call: <span className="font-medium text-navy-800">{lead.callTime}</span></p>}
          </div>
        )}

        {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={logContact} className="rounded-2xl border border-navy-100 p-4">
          <p className="mb-3 text-sm font-semibold text-navy-900">Log a contact attempt</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Channel" options={['Call', 'WhatsApp', 'Email', 'Meeting'].map((v) => ({ value: v, label: v }))} value={channel} onChange={(e) => setChannel(e.target.value)} />
            <SelectField
              label="Outcome"
              placeholder="Choose outcome"
              options={['Reached', 'No answer', 'Call back later', 'Wrong number', 'Not interested'].map((v) => ({ value: v, label: v }))}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
          <label htmlFor="lead-notes" className="mb-1.5 mt-3 block text-sm font-medium text-navy-800">Notes</label>
          <textarea id="lead-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" placeholder="What was discussed?" />
          <Button type="submit" size="sm" className="mt-3">Save contact</Button>
        </form>

        <div className="rounded-2xl border border-navy-100 p-4">
          <p className="mb-3 text-sm font-semibold text-navy-900">Stage</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SelectField label="Move to" options={LEAD_STAGES.map((s) => ({ value: s.key, label: s.label }))} value={stage} onChange={(e) => setStage(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={saveStage} disabled={stage === lead.stage}>Update stage</Button>
          </div>
          {movingBack && (
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-3 resize-none" placeholder="Reason for moving back (required)" aria-label="Reason for moving back" />
          )}
          {lead.stage === 'assessed' && (
            <p className="mt-3 text-xs text-navy-500">
              Next: ask {lead.name.split(' ')[0]} to create their account on the website with {lead.email}. Their enquiry is linked to it automatically.
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-navy-100 p-4">
            <p className="mb-1 text-sm font-semibold text-navy-900">{lead.counsellorId ? 'Reassign (admin)' : 'Assign to a counsellor (optional)'}</p>
            {!lead.counsellorId && (
              <p className="mb-3 text-xs text-navy-500">The admin handles website enquiries. Assigning one lets a counsellor follow it up; it doesn't decide the student's counsellor after they register.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="New counsellor"
                placeholder="Choose counsellor"
                options={activeCounsellors().filter((c) => c.id !== lead.counsellorId).map((c) => ({ value: c.id, label: c.name }))}
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
              />
              <div>
                <label htmlFor="reassign-reason" className="mb-1.5 block text-sm font-medium text-navy-800">Reason</label>
                <input id="reassign-reason" value={ownerReason} onChange={(e) => setOwnerReason(e.target.value)} className="input" placeholder="e.g. Specialises in Germany" />
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={reassign}>{lead.counsellorId ? 'Reassign lead' : 'Assign lead'}</Button>
          </div>
        )}

        <div>
          <p className="mb-3 text-sm font-semibold text-navy-900">Activity</p>
          {lead.activities.length === 0 ? (
            <p className="text-sm text-navy-400">No contact yet.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-navy-100 pl-4">
              {lead.activities.map((a, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-navy-900">{a.channel} · {a.outcome}</p>
                  {a.notes && <p className="text-navy-600">{a.notes}</p>}
                  <p className="text-xs text-navy-400">{formatDateTime(a.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function LeadsPage() {
  const scope = useStaffScope();
  const [allLeads] = useLeads();
  const [owner, setOwner] = useState<string>('all');
  const leads = allLeads.filter((l) => scope.canSee(l.counsellorId) && (owner === 'all' || (owner === 'admin' ? !l.counsellorId : l.counsellorId === owner)));
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StageFilter>('all');
  const openId = params.get('open');
  const openLead = leads.find((l) => l.id === openId);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) => (filter === 'all' ? true : l.stage === filter))
      .filter((l) => !q || [l.name, l.email, l.mobile, l.city, l.interest].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, query, filter]);

  const options: { value: StageFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: leads.length },
    ...LEAD_STAGES.map((s) => ({ value: s.key as StageFilter, label: s.label, count: leads.filter((l) => l.stage === s.key).length })),
  ];

  const open = (id: string) => setParams({ open: id });

  return (
    <>
      <PageHeader title="Leads" description={scope.isAdmin ? 'All enquiries, newest first.' : 'Enquiries assigned to you, newest first.'} />
      {scope.isAdmin && (
        <div className="mb-4">
          <FilterChips
            label="Filter by counsellor"
            value={owner}
            onChange={setOwner}
            options={[
              { value: 'all', label: 'All', count: allLeads.length },
              { value: 'admin', label: 'Admin (website enquiries)', count: allLeads.filter((l) => !l.counsellorId).length },
              ...counsellors.map((c) => ({ value: c.id, label: c.name, count: allLeads.filter((l) => l.counsellorId === c.id).length })),
            ]}
          />
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, city…" />
        <FilterChips label="Filter by stage" options={options} value={filter} onChange={setFilter} />
      </div>

      {visible.length === 0 ? (
        <EmptyState>No leads match your search.</EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-navy-50/60 text-xs uppercase tracking-wider text-navy-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Interest</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Readiness</th>
                {scope.isAdmin && <th className="px-5 py-3 font-semibold">Counsellor</th>}
                <th className="px-5 py-3 font-semibold">Enquired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {visible.map((l) => (
                <tr key={l.id} onClick={() => open(l.id)} className="cursor-pointer transition hover:bg-ivory">
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => open(l.id)} className="text-left font-semibold text-navy-900 hover:text-gold-700">{l.name}</button>
                    <p className="text-xs text-navy-500">{l.city}</p>
                  </td>
                  <td className="px-5 py-4 text-navy-700">{l.interest}</td>
                  <td className="px-5 py-4 text-navy-600">{l.source}</td>
                  <td className="px-5 py-4"><Pill tone={stageTone(l.stage)}>{stageLabel(l.stage)}</Pill></td>
                  <td className="px-5 py-4"><ScoreBar score={l.score} /></td>
                  {scope.isAdmin && <td className="px-5 py-4 text-navy-700">{l.counsellorId ? counsellorName(l.counsellorId) : 'Admin'}</td>}
                  <td className="px-5 py-4 text-navy-500">{relativeTime(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards on small screens */}
          <ul className="divide-y divide-navy-100 md:hidden">
            {visible.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => open(l.id)} className="w-full px-5 py-4 text-left transition hover:bg-ivory">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">{l.name}</p>
                      <p className="text-xs text-navy-500">{l.interest}</p>
                    </div>
                    <Pill tone={stageTone(l.stage)}>{stageLabel(l.stage)}</Pill>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-navy-500">
                    <span>{l.source} · {relativeTime(l.createdAt)}{scope.isAdmin && ` · ${l.counsellorId ? counsellorName(l.counsellorId) : 'Admin'}`}</span>
                    <ScoreBar score={l.score} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openLead && (
        <LeadDetails
          key={openLead.id}
          lead={openLead}
          isAdmin={scope.isAdmin}
          onClose={() => setParams({})}
        />
      )}
    </>
  );
}
