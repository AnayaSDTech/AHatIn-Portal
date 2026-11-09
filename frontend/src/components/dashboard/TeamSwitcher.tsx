import { teamTitle, type StudentTeam, type TeamArea } from '../../data/staff';
import { cn, initials } from '../../lib/utils';

export const TEAM_AREAS = ['counsellor', 'finance', 'visa'] as const;
const avatarTone: Record<TeamArea, string> = { counsellor: 'bg-gold-500 text-navy-950', finance: 'bg-navy-900 text-gold-400', visa: 'bg-sky-600 text-white' };

export function TeamAvatar({ area, name, size = 'md' }: { area: TeamArea; name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full font-display', size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base', avatarTone[area])} aria-hidden>
      {initials(name)}
    </span>
  );
}

/**
 * The people looking after the student, to pick whose chat or sessions to show. A list down the side on large screens,
 * a row of tabs that scrolls sideways on small ones.
 */
export function TeamSwitcher({
  team,
  active,
  onSelect,
  label,
  badge,
  dataAttr,
}: {
  team: StudentTeam;
  active: TeamArea;
  onSelect: (area: TeamArea) => void;
  /** e.g. "Chats", for screen readers. */
  label: string;
  /** A count beside a person, e.g. unread messages. */
  badge?: (area: TeamArea) => { count: number; tone: 'red' | 'blue' } | null;
  /** The data attribute each tab carries, e.g. "data-chat". */
  dataAttr: string;
}) {
  const areas = TEAM_AREAS.filter((k) => team[k]);
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:gap-1 lg:overflow-visible">
      {areas.map((k) => {
        const person = team[k]!;
        const selected = active === k;
        const b = badge?.(k);
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(k)}
            {...{ [dataAttr]: k }}
            className={cn(
              'flex min-w-[13rem] shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition lg:min-w-0',
              selected ? 'bg-white shadow-soft ring-navy-200' : 'ring-transparent hover:bg-white/70',
            )}
          >
            <TeamAvatar area={k} name={person.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-navy-900">{person.name}</span>
              <span className="block truncate text-xs text-navy-500">{teamTitle[k]}</span>
            </span>
            {b && b.count > 0 && (
              <span className={cn('grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold', b.tone === 'red' ? 'bg-red-500 text-white' : 'bg-sky-100 text-sky-800')}>{b.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
