import { useApi } from './api/store';

/** The business rules from the admin's Settings page, as every staff member can read them. */
export interface BusinessRules {
  workingHours: { days: number[]; start: string; end: string; label: string };
  quietHours: { start: string; end: string };
  followUpLimits: {
    firstContactMinutes: number;
    firstContactNextDay: string;
    bookSessionHours: number;
    nextFollowUpDays: number;
    planFollowUpHours: number;
    documentCheckWorkingDays: number;
    arrivalCheckInDays: number;
    replyWorkingDays: number;
    assignWorkingDays: number;
    sessionReminderHours: number;
    deadlineReminderDays: number[];
  };
}

/** The current rules (null until loaded). Shares its data with the Settings page, so a saved change shows everywhere. */
export function useBusinessRules(): BusinessRules | null {
  const rules = useApi<BusinessRules | null>('/settings', null)[0];
  // An older backend doesn't send these yet: then the info icons simply don't show.
  return rules?.followUpLimits && rules.workingHours?.label ? rules : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What staff must do at each lead stage, and by when, with the current values from Settings. */
export function leadStageRule(stage: string, rules: BusinessRules): string {
  const f = rules.followUpLimits;
  const wh = rules.workingHours;
  switch (stage) {
    case 'new_lead':
      return `Make first contact within ${plural(f.firstContactMinutes, 'minute')} during working hours (${wh.label}, ${wh.start}–${wh.end} IST). Enquiries that arrive out of hours: by ${f.firstContactNextDay} on the next working day. If missed, managers are alerted.`;
    case 'contacted':
      return `Book an assessment session within ${plural(f.bookSessionHours, 'hour')} of first reaching them. Not booked yet? After each further contact attempt, follow up again within ${plural(f.nextFollowUpDays, 'day')}. After 3 unanswered attempts, managers are alerted. If a follow-up is missed, managers are alerted too.`;
    case 'assessment_booked':
      return 'No time limit. Hold the assessment session, then share the plan and move the lead to "Assessed / plan shared".';
    case 'assessed':
      return `If they haven't registered yet, follow up within ${plural(f.planFollowUpHours, 'hour')}. If missed, managers are alerted.`;
    default:
      return '';
  }
}
