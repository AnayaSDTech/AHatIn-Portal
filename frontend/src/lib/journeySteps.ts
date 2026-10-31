import { DEPARTURE_TASKS, VISA_PATH, scholarshipStatusLabel, visaStageLabel, type ServiceCode, type ServiceStatus } from './journey';
import { appStateLabel, type StaffStudent } from '../data/staff';
import type { Session } from './scheduling';
import { formatDate } from './utils';

/*
 * What has been done, what is happening now and what comes next in each part of the student's journey, from the
 * shared record. Shown under each stage of the student's progress tracker ("View details").
 */

export type StepState = 'done' | 'now' | 'next';

export interface Step {
  label: string;
  state: StepState;
  /** e.g. a date or "2 of 3". */
  detail?: string;
}

/** The steps of one stage, and a list of the things in it (applications, scholarships) when it has any. */
export interface StageSteps {
  steps: Step[];
  list?: { title: string; rows: { label: string; status: string; done: boolean }[] };
}

const lakh = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} lakh`;
const on = (iso?: string) => (iso ? formatDate(iso) : undefined);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/**
 * Once a stage has started, the first step that isn't done is happening now and the ones after it come next.
 * Before it starts, every step still to do is coming up.
 */
function sequencer(started: boolean) {
  return (steps: { label: string; done: boolean; detail?: string; skip?: boolean }[]): Step[] => {
    let current = false;
    return steps
      .filter((st) => !st.skip)
      .map((st) => {
        if (st.done) return { label: st.label, state: 'done' as const, detail: st.detail };
        const state: StepState = !current && started ? 'now' : 'next';
        current = true;
        return { label: st.label, state, detail: st.detail };
      });
  };
}

/** `status` is the stage's status in the tracker (from computeServices). */
export function stageSteps(code: ServiceCode, s: StaffStudent, sessions: Session[], status: ServiceStatus): StageSteps {
  const j = s.journey;
  const apps = s.applications;
  const sequence = sequencer(status === 'in_progress' || status === 'completed');
  switch (code) {
    case 'S1': {
      const mine = sessions.filter((x) => x.studentId === s.id && x.type === 'Career counselling');
      const held = mine.find((x) => x.status === 'completed');
      const booked = mine.find((x) => x.status === 'booked');
      const sl = j.shortlist;
      return { steps: sequence([
        { label: 'Counsellor assigned to you', done: !!s.counsellorId },
        {
          label: held || (j.careerPlan && !booked) ? 'Career counselling session held' : booked ? 'Career counselling session booked' : 'Book a career counselling session',
          done: !!held || !!booked || !!j.careerPlan,
          detail: on(held?.date ?? booked?.date),
        },
        { label: 'Career plan agreed and shared with you', done: !!j.careerPlan, detail: on(j.careerPlan?.at) },
        { label: 'Your counsellor prepares a shortlist of universities', done: !!sl?.sharedAt || (!!sl && sl.status !== 'draft'), detail: sl?.items.length ? plural(sl.items.length, 'option') : undefined },
        { label: 'Shortlist shared with you', done: !!sl?.sharedAt || (!!sl && sl.status !== 'draft'), detail: on(sl?.sharedAt) },
      ]) };
    }
    case 'S3': {
      const sl = j.shortlist;
      const chosen = sl?.items.filter((i) => i.choice === 'apply').length ?? 0;
      // Approving the shortlist is the first step here, and it is the student's as soon as the shortlist is shared.
      const sequenceApps = sl?.status === 'shared' || sl?.firstApprovedAt ? sequencer(true) : sequence;
      const sent = apps.filter((a) => a.state !== 'draft' && a.state !== 'withdrawn');
      const decided = apps.filter((a) => ['conditional_offer', 'unconditional_offer', 'accepted', 'declined', 'rejected'].includes(a.state));
      const offers = apps.filter((a) => ['conditional_offer', 'unconditional_offer', 'accepted', 'declined'].includes(a.state));
      const accepted = apps.find((a) => a.state === 'accepted');
      const steps = sequenceApps(
        [
          { label: 'You choose where to apply and approve the shortlist', done: !!sl?.firstApprovedAt, detail: sl?.firstApprovedAt ? `${plural(chosen, 'option')} chosen · ${on(sl.firstApprovedAt)}` : undefined },
          { label: 'Applications prepared from your shortlist', done: sent.length > 0 || !!accepted, detail: apps.length ? plural(apps.length, 'application') : undefined },
          { label: 'Applications submitted to universities', done: apps.length > 0 && apps.every((a) => a.state !== 'draft'), detail: apps.length ? `${sent.length} of ${apps.length}` : undefined },
          { label: 'Waiting for university decisions', done: sent.length > 0 && decided.length >= sent.length, detail: sent.length ? `${decided.length} of ${sent.length} decided` : undefined },
          { label: 'You accept an offer', done: !!accepted, detail: accepted ? accepted.university : offers.length ? plural(offers.length, 'offer') : undefined },
        ],
      );
      // Where each application is.
      // Each application: under way until the university decides (or it is withdrawn).
      const settled = ['accepted', 'declined', 'rejected', 'withdrawn', 'conditional_offer', 'unconditional_offer'];
      return {
        steps,
        list: apps.length ? { title: 'Your applications', rows: apps.map((a) => ({ label: `${a.university} · ${a.course}`, status: appStateLabel[a.state], done: settled.includes(a.state) })) } : undefined,
      };
    }
    case 'S4': {
      const f = j.funding;
      const funds = s.documents.filter((d) => d.category === 'funds');
      const verified = funds.filter((d) => d.state === 'verified').length;
      const covered = f.sources.reduce((n, x) => n + x.amount, 0);
      return {
        steps: sequence(
          [
            { label: 'Financial Aid Officer assigned to you', done: !!s.financeOfficerId, skip: !s.financeOfficerId && !!f.estimatedCost },
            { label: 'Estimated cost of study set', done: !!f.estimatedCost, detail: f.estimatedCost ? lakh(f.estimatedCost) : undefined },
            { label: 'Your funding plan covers the cost', done: !!f.estimatedCost && covered >= f.estimatedCost, detail: f.sources.length ? `${lakh(covered)} planned` : undefined },
            { label: 'Proof of funds uploaded and verified', done: funds.length > 0 && verified === funds.length, detail: funds.length ? `${verified} of ${funds.length} verified` : undefined },
          ],
        ),
        list: f.scholarships.length
          ? { title: 'Scholarships suggested for you', rows: f.scholarships.map((x) => ({ label: x.name, status: scholarshipStatusLabel[x.status], done: x.status === 'awarded' || x.status === 'not_awarded' })) }
          : undefined,
      };
    }
    case 'S5': {
      const v = j.visa;
      const reached = (stage: string) => !!v && (v.stage === 'granted' || v.history.some((h) => h.stage === stage) || VISA_PATH.indexOf(v.stage as never) >= VISA_PATH.indexOf(stage as never));
      const when = (stage: string) => on(v?.history.find((h) => h.stage === stage)?.at);
      return { steps: sequence(
        [
          { label: 'Visa Officer assigned to you', done: !!s.visaOfficerId, skip: !s.visaOfficerId && !!j.visa },
          ...VISA_PATH.map((stage) => ({ label: visaStageLabel[stage], done: reached(stage), detail: when(stage) })),
          { label: v?.stage === 'refused' ? 'Visa refused' : 'Visa decision', done: v?.stage === 'granted', detail: v?.stage === 'granted' ? when('granted') : v?.stage === 'refused' ? v.refusalReason : undefined },
        ],
      ) };
    }
    case 'S6': {
      const d = j.departure;
      return { steps: sequence(
        [
          ...DEPARTURE_TASKS.map((t) => ({ label: t.label, done: !!d.done[t.key], detail: on(d.done[t.key]) })),
          { label: 'Your Visa Officer confirms you are ready to travel', done: !!d.confirmedAt, detail: on(d.confirmedAt) },
        ],
      ) };
    }
    case 'S7': {
      const a = j.arrival;
      return { steps: sequence(
        [
          { label: 'You tell us you have arrived safely', done: !!a.arrivedAt, detail: on(a.arrivedAt) },
          { label: 'Check-ins during your first months', done: !!a.finalCheckInAt },
          { label: 'Final check-in: settled in', done: !!a.finalCheckInAt, detail: on(a.finalCheckInAt) },
        ],
      ) };
    }
  }
}
