import { contact } from '../data/site';
import { useApi } from './api/store';

/**
 * The office hours set on the admin's Settings page, e.g. "Mon–Sat, 10:00–19:00 IST". Until they have loaded (or if the backend
 * can't be reached) the website's fixed text is shown instead.
 */
export function useOfficeHours(): string {
  const [hours] = useApi<{ label?: string } | null>('/office-hours', null);
  return hours?.label || contact.hours;
}
