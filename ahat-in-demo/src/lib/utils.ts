/** Join class names, skipping empty values. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Format a YYYY-MM-DD date as "21 Oct 2026". */
/** "24 Oct 2026" for a YYYY-MM-DD date or a full ISO date-time. */
export function formatDate(iso: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whole days from today until a YYYY-MM-DD date (negative if past). */
export function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

/** "in 9 min", "7 min ago", "in 3 h", "2 days ago" for an ISO date-time. */
export function relativeTime(iso: string) {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(diffMin);
  if (abs === 0) return 'just now';
  const days = Math.round(abs / (60 * 24));
  const text = abs < 60 ? `${abs} min` : abs < 60 * 24 ? `${Math.round(abs / 60)} h` : `${days} ${days === 1 ? 'day' : 'days'}`;
  return diffMin >= 0 ? `in ${text}` : `${text} ago`;
}

/** "22 Oct, 15:40" for an ISO date-time. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
