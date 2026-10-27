import { api } from './api/client';
import type { EnquiryForm } from './validation';

/**
 * The homepage enquiry form, without an account. The backend creates a lead for the admin to handle (or adds it
 * to an existing lead or student) and schedules the first-contact follow-up.
 */

export const enquiryDestinations = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'europe', label: 'Europe (Germany, Ireland, France)' },
  { value: 'undecided', label: 'Not sure yet' },
];

export const enquiryIntakes = [
  { value: '2027-01', label: 'January 2027' },
  { value: '2027-09', label: 'September 2027' },
  { value: '2028-01', label: 'January 2028' },
  { value: '2028-09', label: 'September 2028' },
  { value: 'unsure', label: 'Not sure yet' },
];

export const callTimes = [
  { value: '', label: 'Any time' },
  { value: 'Morning (10:00–13:00)', label: 'Morning (10:00–13:00)' },
  { value: 'Afternoon (13:00–16:00)', label: 'Afternoon (13:00–16:00)' },
  { value: 'Evening (16:00–19:00)', label: 'Evening (16:00–19:00)' },
];

export interface EnquiryResult {
  /** new: a new lead; lead: added to an existing lead; student: added to a registered student's record. */
  kind: 'new' | 'lead' | 'student' | 'ignored';
  /** Who will reply; null when the AHat team (admin) handles it. */
  counsellor?: string | null;
}

export const submitEnquiry = (d: EnquiryForm) => api.post<EnquiryResult>('/enquiries', d);
