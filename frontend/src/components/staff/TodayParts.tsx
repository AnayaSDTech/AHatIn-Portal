import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, CalendarDays, Check, CheckCircle2, ClipboardList, FileSearch, MessageCircle, MessageSquare, Phone, PlaneLanding } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SessionRow } from '../scheduling/SessionManage';
import { counsellorName, type FollowUp, type FollowUpType, type Message, type StaffStudent } from '../../data/staff';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';
import type { Session } from '../../lib/scheduling';
import { cn, initials, relativeTime } from '../../lib/utils';

/* The building blocks of the staff "Today" dashboards (counsellors, admins and officers). */

const typeIcon: Record<FollowUpType, LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  verify: FileSearch,
  reminder: AlarmClock,
  checkin: PlaneLanding,
};

export type TaskTab = 'overdue' | 'today' | 'upcoming' | 'done';

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const todayLabel = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** A small count card; clicking it opens what it counts. */
export function Stat({ label, value, icon: Icon, tone, onClick, href }: { label: string; value: number; icon: LucideIcon; tone: string; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', value ? tone : 'bg-navy-50 text-navy-400')}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block font-display text-2xl leading-none text-navy-900">{value}</span>
        <span className="mt-1 block text-xs font-medium text-navy-500">{label}</span>
      </span>
    </>
  );
  const cls = 'card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift';
  return href ? (
    <Link to={href} className={cls} data-stat={label}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} data-stat={label}>
      {body}
    </button>
  );
}

export function Section({ id, title, icon: Icon, action, children }: { id?: string; title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-28 overflow-hidden" aria-label={title}>
      <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-navy-900">
          <Icon className="h-4 w-4 text-navy-400" aria-hidden /> {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-navy-400">
      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> {children}
    </p>
  );
}

/** Follow-ups split into the task tabs. */
export function splitTasks(followUps: FollowUp[]): Record<TaskTab, FollowUp[]> {
  const now = Date.now();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const open = followUps.filter((f) => !f.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return {
    overdue: open.filter((f) => new Date(f.dueAt).getTime() < now),
    today: open.filter((f) => new Date(f.dueAt).getTime() >= now && new Date(f.dueAt) <= endOfDay),
    upcoming: open.filter((f) => new Date(f.dueAt) > endOfDay),
    done: followUps.filter((f) => f.done),
  };
}

/** The most urgent task list that has something in it. */
export const firstTab = (tasks: Record<TaskTab, FollowUp[]>): TaskTab => (tasks.overdue.length ? 'overdue' : tasks.today.length ? 'today' : 'upcoming');

const tabs: { key: TaskTab; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'done', label: 'Done' },
];

export function TasksSection({ tasks, current, onTab, showCounsellor }: { tasks: Record<TaskTab, FollowUp[]>; current: TaskTab; onTab: (t: TaskTab) => void; showCounsellor: boolean }) {
  const now = Date.now();
  const complete = (id: string) => act(() => api.post(`/follow-ups/${id}/done`));
  return (
    <Section id="tasks" title="Tasks" icon={ClipboardList}>
      <div className="flex gap-1 overflow-x-auto border-b border-navy-100 px-3 pt-2" role="tablist" aria-label="Tasks">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current === t.key}
            onClick={() => onTab(t.key)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
              current === t.key ? 'border-navy-900 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700',
            )}
            data-task-tab={t.key}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px] font-bold',
                t.key === 'overdue' && tasks.overdue.length ? 'bg-red-500 text-white' : current === t.key ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-600',
              )}
            >
              {tasks[t.key].length}
            </span>
          </button>
        ))}
      </div>
      {tasks[current].length === 0 ? (
        <AllClear>{current === 'done' ? 'Nothing completed in the last 30 days' : 'All clear'}</AllClear>
      ) : (
        <ul className="divide-y divide-navy-100">
          {tasks[current].map((f) => {
            const Icon = typeIcon[f.type];
            const late = !f.done && new Date(f.dueAt).getTime() < now;
            const href = f.personType === 'lead' ? `/staff/leads?open=${f.personId}` : `/staff/students/${f.personId}`;
            return (
              <li key={f.id} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-ivory/60" data-task={f.id}>
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', late ? 'bg-red-50 text-red-600' : f.done ? 'bg-emerald-50 text-emerald-600' : 'bg-navy-50 text-navy-600')}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <Link to={href} className="min-w-0 flex-1" title={f.rule}>
                  <span className="block truncate text-sm font-semibold text-navy-900">{f.action}</span>
                  <span className="block truncate text-xs text-navy-500">
                    {f.person}
                    {showCounsellor && f.counsellorId && ` · ${counsellorName(f.counsellorId)}`}
                  </span>
                </Link>
                <span className={cn('shrink-0 text-xs font-semibold', late ? 'text-red-600' : f.done ? 'text-emerald-600' : 'text-navy-400')}>
                  {f.done ? 'Done' : late ? `${relativeTime(f.dueAt).replace(' ago', '')} late` : relativeTime(f.dueAt)}
                </span>
                {!f.done && (
                  <button
                    type="button"
                    onClick={() => complete(f.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-navy-100 text-navy-500 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
                    aria-label={`Mark done: ${f.action}, ${f.person}`}
                    title="Mark done"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function SessionsTodaySection({ sessions, nameOf, showCounsellor }: { sessions: Session[]; nameOf: (studentId: string) => string; showCounsellor: boolean }) {
  return (
    <Section
      title={`Sessions today · ${sessions.length}`}
      icon={CalendarDays}
      action={
        <Link to="/staff/schedule" className="text-xs font-semibold text-navy-500 hover:text-navy-900">
          Schedule
        </Link>
      }
    >
      {sessions.length === 0 ? (
        <AllClear>No sessions today</AllClear>
      ) : (
        <div className="space-y-2 p-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} studentName={nameOf(s.studentId)} showCounsellor={showCounsellor} stacked />
          ))}
        </div>
      )}
    </Section>
  );
}

export interface UnreadThread {
  studentId: string;
  name: string;
  count: number;
  last: Message;
}

/** Students with messages waiting for a reply, newest first (only the given chat, when one is named). */
export function unreadThreads(students: StaffStudent[], messages: Message[], thread?: string): UnreadThread[] {
  return students
    .map((s) => {
      const unread = messages
        .filter((m) => m.studentId === s.id && m.from === 'student' && !m.readAt && (!thread || (m.thread ?? 'counsellor') === thread))
        .sort((a, b) => a.at.localeCompare(b.at));
      return { studentId: s.id, name: s.name, count: unread.length, last: unread[unread.length - 1] };
    })
    .filter((t): t is UnreadThread => t.count > 0)
    .sort((a, b) => b.last.at.localeCompare(a.last.at));
}

export function MessagesSection({ threads }: { threads: UnreadThread[] }) {
  return (
    <Section id="messages" title={`Messages · ${threads.length}`} icon={MessageSquare}>
      {threads.length === 0 ? (
        <AllClear>No unread messages</AllClear>
      ) : (
        <ul className="divide-y divide-navy-100" aria-label="Unread messages">
          {threads.map((t) => (
            <li key={t.studentId}>
              <Link to={`/staff/students/${t.studentId}#messages`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ivory/60" data-unread-thread={t.studentId}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(t.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy-900">{t.name}</span>
                    <span className="shrink-0 text-[11px] text-navy-400">{relativeTime(t.last.at)}</span>
                  </span>
                  <span className="block truncate text-xs text-navy-500">{t.last.text}</span>
                </span>
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
