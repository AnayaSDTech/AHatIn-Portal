import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, CalendarDays, CheckCircle2, ClipboardCheck, FileSearch, MessageCircle, MessageSquare, Phone, PlaneLanding, ShieldCheck, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUps, useLeads, useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { SessionRow } from '../../components/scheduling/SessionManage';
import { counsellorName } from '../../data/staff';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';
import { isoDate } from '../../lib/scheduling';
import { PageHeader, StatCard } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import type { FollowUpType } from '../../data/staff';
import { cn, formatDate, initials, relativeTime } from '../../lib/utils';

const typeIcon: Record<FollowUpType, LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  verify: FileSearch,
  reminder: AlarmClock,
  checkin: PlaneLanding,
};

export function TodayPage() {
  const { user } = useAuth();
  const scope = useStaffScope();
  const [allFollowUps] = useFollowUps();
  const [allLeads] = useLeads();
  const [allStudents] = useStaffStudents();
  const [sessions] = useSessions();
  const [showDone, setShowDone] = useState(false);

  // Only the follow-ups, leads and students this person may see.
  const followUps = allFollowUps.filter((f) => scope.canSee(f.counsellorId));
  const leads = allLeads.filter((l) => scope.canSee(l.counsellorId));
  const students = scope.filterStudents(allStudents);
  const todayIso = isoDate(new Date());
  const todaysSessions = sessions
    .filter((s) => s.date === todayIso && s.status !== 'cancelled' && (scope.isAdmin || s.counsellorId === scope.myId))
    .sort((a, b) => a.time.localeCompare(b.time));
  const nameOf = (id: string) => allStudents.find((s) => s.id === id)?.name ?? 'Student';

  // Students (that this person may see) with messages waiting for a reply, newest first.
  const [messages] = useMessages();
  const unreadThreads = students
    .map((s) => {
      const unread = messages.filter((m) => m.studentId === s.id && m.from === 'student' && !m.readAt).sort((a, b) => a.at.localeCompare(b.at));
      return { studentId: s.id, name: s.name, count: unread.length, last: unread[unread.length - 1] };
    })
    .filter((t): t is typeof t & { last: NonNullable<typeof t.last> } => t.count > 0)
    .sort((a, b) => b.last.at.localeCompare(a.last.at));

  const now = Date.now();
  const open = followUps.filter((f) => !f.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const done = followUps.filter((f) => f.done);
  const overdue = open.filter((f) => new Date(f.dueAt).getTime() < now);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const dueToday = open.filter((f) => new Date(f.dueAt).getTime() >= now && new Date(f.dueAt) <= endOfDay);
  const newLeads = leads.filter((l) => l.stage === 'new_lead').length;
  const docsToVerify = students.reduce((n, s) => n + s.documents.filter((d) => d.state === 'pending').length, 0);

  const complete = (id: string) => act(() => api.post(`/follow-ups/${id}/done`));
  const list = showDone ? done : open;

  return (
    <>
      <PageHeader title={`Today, ${user?.name.split(' ')[0] ?? ''}`} description="Your follow-ups, ordered by urgency. Time limits come from AHat's follow-up rules." />

      {scope.covering.map((g) => (
        <div key={g.id} role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            You're covering for <span className="font-semibold">{counsellorName(g.ownerId)}</span> until {formatDate(g.until)} ({g.reason}). Their leads, students and
            follow-ups are included below.
          </p>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overdue follow-ups" value={overdue.length} icon={AlarmClock} tone={overdue.length ? 'red' : 'green'} note={overdue.length ? 'Your manager has been alerted' : 'Nothing overdue'} />
        <StatCard label="Due today" value={dueToday.length} icon={ClipboardCheck} tone="amber" />
        <StatCard label="New leads" value={newLeads} icon={UserPlus} tone="blue" note="Waiting for first contact" />
        <StatCard label="Documents to verify" value={docsToVerify} icon={FileSearch} tone="navy" />
      </div>

      <Panel title={`Unread messages (${unreadThreads.length})`} icon={<MessageSquare className="h-4 w-4" aria-hidden />} className="mt-6">
        {unreadThreads.length === 0 ? (
          <p className="text-sm text-navy-400">No unread messages from students.</p>
        ) : (
          <ul className="divide-y divide-navy-100" aria-label="Unread messages">
            {unreadThreads.map((t) => (
              <li key={t.studentId}>
                <Link to={`/staff/students/${t.studentId}#messages`} className="flex items-center gap-3 py-3 transition hover:bg-ivory/60" data-unread-thread={t.studentId}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(t.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy-900">{t.name}</span>
                    <span className="block truncate text-sm text-navy-600">{t.last.text}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-navy-400">{relativeTime(t.last.at)}</span>
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{t.count}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={`Today's sessions (${todaysSessions.length})`}
        icon={<CalendarDays className="h-4 w-4" aria-hidden />}
        className="mt-6"
        action={<Link to="/staff/schedule" className="text-sm font-semibold text-navy-600 hover:text-gold-700">Open schedule</Link>}
      >
        {todaysSessions.length === 0 ? (
          <p className="text-sm text-navy-400">No sessions today.</p>
        ) : (
          <div className="space-y-2">
            {todaysSessions.map((s) => (
              <SessionRow key={s.id} session={s} studentName={nameOf(s.studentId)} showCounsellor={scope.isAdmin} />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={showDone ? 'Completed follow-ups' : 'Follow-ups'}
        className="mt-6"
        action={
          <button type="button" onClick={() => setShowDone((s) => !s)} className="text-sm font-semibold text-navy-600 hover:text-gold-700">
            {showDone ? `Show open (${open.length})` : `Show completed (${done.length})`}
          </button>
        }
      >
        {list.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-6 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden /> {showDone ? 'Nothing completed yet.' : 'All follow-ups done. Great work!'}
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {list.map((f) => {
              const Icon = typeIcon[f.type];
              const late = !f.done && new Date(f.dueAt).getTime() < now;
              const href = f.personType === 'lead' ? `/staff/leads?open=${f.personId}` : `/staff/students/${f.personId}`;
              return (
                <li key={f.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', late ? 'bg-red-50 text-red-600' : 'bg-navy-50 text-navy-700')}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">
                      {f.action} · <Link to={href} className="text-navy-700 underline decoration-navy-200 underline-offset-2 hover:text-gold-700">{f.person}</Link>
                    </p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      Rule: {f.rule} ·{' '}
                      <span className={cn(late ? 'font-semibold text-red-600' : 'text-navy-500')}>
                        {f.done ? 'Done' : late ? `Overdue by ${relativeTime(f.dueAt).replace(' ago', '')}` : `Due ${relativeTime(f.dueAt)}`}
                      </span>
                    </p>
                  </div>
                  {!f.done && (
                    <div className="flex gap-2">
                      <Link to={href} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-navy-900">
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => complete(f.id)}
                        className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                      >
                        Mark done
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
