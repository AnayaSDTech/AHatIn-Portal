import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStaffStudents } from './useStaffData';
import { readShared } from '../lib/demoStore';
import { uid } from '../lib/crypto';
import {
  DEPARTURE_TASKS,
  SERVICE_TITLES,
  serviceStatusLabel,
  visaStageLabel,
  type Journey,
  type ScholarshipStatus,
  type ServiceCode,
  type ServiceStatus,
  type ShortlistItem,
  type VisaStage,
} from '../lib/journey';
import { advanceStage, appStateLabel, demoStudents, type AppState, type DocCategory, type StaffStudent, type StageKey } from '../data/staff';

/**
 * Every event that moves a student's journey forward, in one place. Student and staff screens both call
 * these, so the shared record (and the progress worked out from it) is always the same on both sides.
 * Each event also adds a line to the student's history, so staff can see who did what and when.
 * DEMO ONLY: the real portal runs these rules in the FastAPI backend.
 */
export function useStudentActions(studentId: string | undefined) {
  const { user } = useAuth();
  const [, setStudents] = useStaffStudents();
  const isStudent = user?.role === 'student' || user?.role === 'parent';
  const by = user?.name ?? 'Staff';

  return useMemo(() => {
    const now = () => new Date().toISOString();
    const update = (fn: (s: StaffStudent) => StaffStudent, note?: string) =>
      setStudents((all) =>
        all.map((s) => {
          if (s.id !== studentId) return s;
          const next = fn(s);
          return note ? { ...next, notes: [{ at: now(), by: isStudent ? `${by} (student)` : by, text: note }, ...next.notes] } : next;
        }),
      );
    const journey = (fn: (j: Journey, s: StaffStudent) => Journey) => (s: StaffStudent) => ({ ...s, journey: fn(s.journey, s) });
    const stage = (to: StageKey) => (s: StaffStudent) => advanceStage(s, to);
    const pipe = (...fns: ((s: StaffStudent) => StaffStudent)[]) => (s: StaffStudent) => fns.reduce((acc, f) => f(acc), s);

    return {
      /* ---------- 1. Career counselling ---------- */
      recordCareerPlan: (summary: string) =>
        update(journey((j) => ({ ...j, careerPlan: { at: now(), by, summary } })), `Career plan shared: ${summary}`),

      /* ---------- 2. Shortlist ---------- */
      /**
       * Options can be added at any time. Once shared, the student sees the new option straight away;
       * once approved, adding one re-opens the shortlist for the student (earlier choices are kept).
       */
      addShortlistItem: (item: Omit<ShortlistItem, 'id' | 'comments' | 'choice' | 'removeReason' | 'addedAt'>) => {
        const at = now();
        const before = readShared<StaffStudent[]>('students', demoStudents).find((s) => s.id === studentId)?.journey.shortlist?.status;
        update(
          journey((j) => {
            const sl = j.shortlist ?? { version: 1, status: 'draft' as const, items: [] };
            const items = [...sl.items, { ...item, id: uid(), comments: [], addedAt: at }];
            return {
              ...j,
              shortlist: sl.status === 'approved' ? { ...sl, items, status: 'shared', version: sl.version + 1, sharedAt: at } : { ...sl, items },
            };
          }),
          before === 'shared' || before === 'approved'
            ? `Added ${item.university} (${item.course}) to the shared shortlist${before === 'approved' ? '; the student is asked to review it again' : ''}.`
            : undefined,
        );
      },
      removeShortlistItem: (itemId: string) =>
        update(journey((j) => (j.shortlist ? { ...j, shortlist: { ...j.shortlist, items: j.shortlist.items.filter((i) => i.id !== itemId) } } : j))),
      shareShortlist: () =>
        update(
          pipe(
            journey((j) => (j.shortlist ? { ...j, shortlist: { ...j.shortlist, status: 'shared', sharedAt: now() } } : j)),
            stage('documents_shortlist'),
          ),
          'Shortlist shared with the student for review.',
        ),
      reviseShortlist: () =>
        update(
          journey((j) => (j.shortlist ? { ...j, shortlist: { ...j.shortlist, status: 'draft', version: j.shortlist.version + 1 } } : j)),
          'Started a revised shortlist.',
        ),
      commentOnItem: (itemId: string, text: string) =>
        update(
          journey((j) =>
            j.shortlist
              ? { ...j, shortlist: { ...j.shortlist, items: j.shortlist.items.map((i) => (i.id === itemId ? { ...i, comments: [...i.comments, { at: now(), by, role: isStudent ? 'student' : 'staff', text }] } : i)) } }
              : j,
          ),
          isStudent ? `Question on the shortlist: “${text}”` : undefined,
        ),
      setChoice: (itemId: string, choice: 'apply' | 'removed' | undefined, reason?: string) =>
        update(
          journey((j) =>
            j.shortlist ? { ...j, shortlist: { ...j.shortlist, items: j.shortlist.items.map((i) => (i.id === itemId ? { ...i, choice, removeReason: choice === 'removed' ? reason : undefined } : i)) } } : j,
          ),
        ),
      /** Student approves: draft applications are created for every option they chose. */
      approveShortlist: (summary: string) =>
        update(
          pipe((s) => {
            const sl = s.journey.shortlist;
            if (!sl) return s;
            const chosen = sl.items.filter((i) => i.choice === 'apply');
            const existing = new Set(s.applications.map((a) => `${a.university}|${a.course}`));
            const created = chosen
              .filter((i) => !existing.has(`${i.university}|${i.course}`))
              .map((i) => ({ id: uid(), university: i.university, course: i.course, agency: i.agency, state: 'draft' as AppState, deadline: i.deadline }));
            const at = now();
            return {
              ...s,
              applications: [...s.applications, ...created],
              journey: { ...s.journey, shortlist: { ...sl, status: 'approved', approvedAt: at, firstApprovedAt: sl.firstApprovedAt ?? at } },
            };
          }, stage('documents_shortlist')),
          `Approved the shortlist. ${summary}`,
        ),

      /* ---------- 3. Applications ---------- */
      setApplicationState: (appId: string, university: string, from: AppState, to: AppState) =>
        update(
          (s) => {
            const next = {
              ...s,
              applications: s.applications.map((x) => (x.id === appId ? { ...x, state: to, history: [...(x.history ?? []), { at: now(), by, from, to }] } : x)),
            };
            return to === 'submitted' ? advanceStage(next, 'applications_submitted') : next;
          },
          `${university}: ${appStateLabel[from]} → ${appStateLabel[to]}.`,
        ),
      /** Counsellor fixes a status chosen by mistake: any status except the student's own decisions, with a reason. */
      correctApplicationState: (appId: string, university: string, from: AppState, to: AppState, reason: string) =>
        update(
          (s) => ({
            ...s,
            applications: s.applications.map((x) => (x.id === appId ? { ...x, state: to, history: [...(x.history ?? []), { at: now(), by, from, to, reason }] } : x)),
          }),
          `Corrected ${university}: ${appStateLabel[from]} → ${appStateLabel[to]} (${reason}).`,
        ),
      /** Student accepts or declines an offer. */
      decideOffer: (appId: string, accept: boolean, university: string) =>
        update(
          pipe(
            (s) => ({
              ...s,
              applications: s.applications.map((x) =>
                x.id === appId ? { ...x, state: accept ? 'accepted' : 'declined', history: [...(x.history ?? []), { at: now(), by: `${by} (student)`, from: x.state, to: accept ? 'accepted' : 'declined' }] } : x,
              ),
            }),
            accept ? stage('offer_accepted') : (s) => s,
          ),
          `${accept ? 'Accepted' : 'Declined'} the offer from ${university}.`,
        ),

      /* ---------- 4. Funding ---------- */
      setEstimatedCost: (lakh: number) => update(journey((j) => ({ ...j, funding: { ...j.funding, estimatedCost: lakh } })), `Estimated cost of study set to ₹${lakh} lakh.`),
      addFundingSource: (kind: string, amount: number) =>
        update(journey((j) => ({ ...j, funding: { ...j.funding, sources: [...j.funding.sources, { id: uid(), kind, amount }] } })), `Funding plan: added ${kind} (₹${amount} lakh).`),
      removeFundingSource: (id: string) => update(journey((j) => ({ ...j, funding: { ...j.funding, sources: j.funding.sources.filter((x) => x.id !== id) } }))),
      addScholarship: (name: string, amount: string, deadline: string) =>
        update(
          journey((j) => ({ ...j, funding: { ...j.funding, scholarships: [...j.funding.scholarships, { id: uid(), name, amount, deadline, status: 'to_apply' as ScholarshipStatus }] } })),
          `Suggested scholarship: ${name}.`,
        ),
      setScholarshipStatus: (id: string, status: ScholarshipStatus) =>
        update(journey((j) => ({ ...j, funding: { ...j.funding, scholarships: j.funding.scholarships.map((x) => (x.id === id ? { ...x, status } : x)) } }))),

      /* ---------- Documents (all services) ---------- */
      requestDocument: (name: string, category: DocCategory) =>
        update((s) => ({ ...s, documents: [...s.documents, { id: uid(), name, state: 'missing', category }] }), `Requested document: ${name}.`),
      /** Counsellor removes a duplicate or mistaken request. Verified documents are kept. */
      removeDocument: (docId: string, name: string, hadFile: boolean) =>
        update(
          (s) => ({ ...s, documents: s.documents.filter((d) => d.id !== docId || d.state === 'verified') }),
          `Removed document request: ${name}${hadFile ? ' (including the uploaded file)' : ''}.`,
        ),
      uploadDocument: (docId: string, fileName: string) =>
        update(
          (s) => ({ ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, state: 'pending', fileName, uploadedAt: now(), reason: undefined } : d)) }),
          (() => {
            const d = readShared<StaffStudent[]>('students', demoStudents).find((s) => s.id === studentId)?.documents.find((x) => x.id === docId);
            return `Uploaded “${fileName}”${d ? ` for ${d.name}` : ''}.`;
          })(),
        ),
      /** Student takes back a file uploaded by mistake, before it is checked. */
      removeUpload: (docId: string, name: string) =>
        update(
          (s) => ({ ...s, documents: s.documents.map((d) => (d.id === docId && d.state === 'pending' ? { ...d, state: 'missing', fileName: undefined, uploadedAt: undefined } : d)) }),
          `Removed the uploaded file for ${name}.`,
        ),
      verifyDocument: (docId: string, name: string) =>
        update((s) => ({ ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, state: 'verified', reason: undefined } : d)) }), `Verified document: ${name}.`),
      rejectDocument: (docId: string, name: string, reason: string) =>
        update((s) => ({ ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, state: 'rejected', reason } : d)) }), `Rejected document: ${name} (${reason}).`),

      /* ---------- 5. Visa ---------- */
      setVisaStage: (to: VisaStage, note?: string, reference?: string) =>
        update(
          pipe(
            journey((j) => ({
              ...j,
              visa: {
                stage: to,
                reference: reference ?? j.visa?.reference,
                refusalReason: to === 'refused' ? note : undefined,
                history: [...(j.visa?.history ?? []), { at: now(), by, stage: to, note }],
              },
            })),
            to === 'submitted' ? stage('visa_filed') : to === 'granted' ? stage('visa_granted') : (s) => s,
          ),
          `Visa: ${visaStageLabel[to]}${reference ? ` (reference ${reference})` : ''}${note ? `. ${note}` : '.'}`,
        ),

      /* ---------- 6. Pre-departure ---------- */
      toggleDepartureTask: (key: string) =>
        update(
          journey((j) => {
            const done = { ...j.departure.done };
            if (done[key]) delete done[key];
            else done[key] = now();
            return { ...j, departure: { ...j.departure, done } };
          }),
        ),
      confirmDeparture: () =>
        update(
          journey((j) => ({ ...j, departure: { ...j.departure, confirmedAt: now(), confirmedBy: by } })),
          `Confirmed ready to travel (all ${DEPARTURE_TASKS.length} pre-departure tasks done).`,
        ),

      /* ---------- 7. Post-arrival ---------- */
      confirmArrival: () => update(pipe(journey((j) => ({ ...j, arrival: { ...j.arrival, arrivedAt: now() } })), stage('arrived')), 'Confirmed safe arrival.'),
      recordFinalCheckIn: (note: string) =>
        update(pipe(journey((j) => ({ ...j, arrival: { ...j.arrival, finalCheckInAt: now(), finalNote: note } })), stage('settled')), `Final post-arrival check-in: ${note}`),

      /* ---------- Counsellor override ---------- */
      setOverride: (code: ServiceCode, status: ServiceStatus | null, reason: string) =>
        update(
          journey((j) => {
            const overrides = { ...j.overrides };
            if (status) overrides[code] = { status, reason, by, at: now() };
            else delete overrides[code];
            return { ...j, overrides };
          }),
          status
            ? `${SERVICE_TITLES[code]} set to “${serviceStatusLabel[status]}”: ${reason}`
            : `${SERVICE_TITLES[code]} returned to automatic progress: ${reason}`,
        ),
    };
  }, [setStudents, studentId, isStudent, by]);
}
