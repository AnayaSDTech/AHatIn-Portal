import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ChevronRight, FileSearch, FolderKanban, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUps, useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { Pill } from '../../components/dashboard/Panel';
import { AllClear, MessagesSection, NotificationsSection, Section, SessionsTodaySection, Stat, StatStrip, TasksSection, TodayColumns, TodayHeader, daySummary, firstTab, splitTasks, unreadThreads, type TaskTab } from '../../components/staff/TodayParts';
import { CASE_GROUPS, DESK, officerCase, type OfficerArea } from '../../lib/officerCase';
import { isoDate } from '../../lib/scheduling';
import { cn, initials } from '../../lib/utils';

/** "Today" for Financial Aid and Visa Officers: their caseload, what needs them now, tasks, sessions and their own chats. */
export function OfficerTodayPage({ area }: { area: OfficerArea }) {
  const { user } = useAuth();
  const scope = useStaffScope();
  const [allFollowUps] = useFollowUps();
  const [allStudents] = useStaffStudents();
  const [sessions] = useSessions();
  const [messages] = useMessages();
  const desk = DESK[area];

  // The server returns only the students assigned to this officer.
  const students = scope.filterStudents(allStudents);
  const cases = useMemo(
    () =>
      students
        .map((s) => ({ student: s, c: officerCase(s, area) }))
        .sort((a, b) => b.c.urgency - a.c.urgency || a.student.name.localeCompare(b.student.name)),
    [students, area],
  );
  const followUps = allFollowUps.filter((f) => scope.canSee(f.counsellorId));
  const todayIso = isoDate(new Date());
  const todaysSessions = sessions
    .filter((s) => s.date === todayIso && s.status !== 'cancelled' && s.counsellorId === scope.myId)
    .sort((a, b) => a.time.localeCompare(b.time));
  const nameOf = (id: string) => allStudents.find((s) => s.id === id)?.name ?? 'Student';
  // Only the officer's own chat with each student.
  const threads = unreadThreads(students, messages, area);

  const tasks = splitTasks(followUps);
  const [tab, setTab] = useState<TaskTab | null>(null);
  const current: TaskTab = tab ?? firstTab(tasks);
  const [filter, setFilter] = useState('all');
  const toVerify = cases.reduce((n, x) => n + x.c.toVerify, 0);
  const needsMe = cases.filter((x) => x.c.urgency === 2).length;
  const shown = cases.filter((x) => filter === 'all' || (filter === 'action' ? x.c.urgency === 2 : x.c.group === filter));

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const showTasks = (t: TaskTab) => {
    setTab(t);
    scrollTo('tasks');
  };

  const filters = [
    { value: 'all', label: 'All', count: cases.length },
    { value: 'action', label: 'Needs you', count: needsMe },
    ...CASE_GROUPS[area].map((g) => ({ ...g, count: cases.filter((x) => x.c.group === g.value).length })),
  ];

  return (
    <>
      <TodayHeader name={user?.name ?? ''} summary={daySummary(tasks.overdue.length, tasks.today.length, todaysSessions.length)}>
        <p className="inline-flex items-center gap-3 self-start rounded-2xl bg-navy-900 py-2 pl-2 pr-4 text-white sm:self-auto lg:hidden" data-desk={area}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 text-navy-950">
            <desk.icon className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">{desk.name}</span>
            <span className="block text-[11px] text-navy-200">{desk.covers}</span>
          </span>
        </p>
      </TodayHeader>

      <StatStrip>
        <Stat label="Needs you" value={needsMe} icon={Users} tone="bg-navy-900 text-gold-300" onClick={() => { setFilter('action'); scrollTo('caseload'); }} />
        <Stat label="Documents to check" value={toVerify} icon={FileSearch} tone="bg-amber-50 text-amber-700" onClick={() => { setFilter('action'); scrollTo('caseload'); }} />
        <Stat label="Tasks due" value={tasks.overdue.length + tasks.today.length} icon={AlarmClock} tone={tasks.overdue.length ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-700'} onClick={() => showTasks(tasks.overdue.length ? 'overdue' : 'today')} />
        <Stat label="Unread messages" value={threads.length} icon={MessageSquare} tone="bg-gold-50 text-gold-700" onClick={() => scrollTo('messages')} />
      </StatStrip>

      <TodayColumns
        main={
          <>
          <Section
            id="caseload"
            title={`My caseload · ${cases.length}`}
            icon={FolderKanban}
            action={
              <Link to="/staff/students" className="text-xs font-semibold text-navy-500 hover:text-navy-900">
                All students
              </Link>
            }
          >
            {cases.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-navy-100 px-4 py-3" role="tablist" aria-label="Filter caseload">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      filter === f.value ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50',
                    )}
                    data-case-filter={f.value}
                  >
                    {f.label}
                    <span className={cn('text-[11px]', filter === f.value ? 'text-navy-200' : f.value === 'action' && f.count ? 'font-bold text-amber-700' : 'text-navy-400')}>{f.count}</span>
                  </button>
                ))}
              </div>
            )}
            {cases.length === 0 ? (
              <AllClear>No students assigned to you yet</AllClear>
            ) : shown.length === 0 ? (
              <AllClear>Nothing here</AllClear>
            ) : (
              <ul className="divide-y divide-navy-100" aria-label="Caseload">
                {shown.map(({ student: s, c }) => (
                  <li key={s.id}>
                    <Link to={`/staff/students/${s.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-ivory/60" data-case={s.id}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{initials(s.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-semibold text-navy-900 group-hover:text-gold-700">{s.name}</span>
                          <Pill tone={c.tone}>{c.phase}</Pill>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-navy-400">
                          {s.destination} · {s.intake}
                        </span>
                        <span className={cn('mt-2 flex items-center gap-1.5 text-sm', c.urgency === 2 ? 'font-semibold text-navy-900' : 'text-navy-600')}>
                          {c.urgency === 2 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Needs you" />}
                          <span>{c.next}</span>
                        </span>
                        {c.detail && <span className="mt-0.5 block text-xs text-navy-400">{c.detail}</span>}
                      </span>
                      <span className="hidden w-24 shrink-0 sm:block" aria-label={`${Math.round(c.progress * 100)}% through`}>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-navy-100">
                          <span className={cn('block h-full rounded-full', c.progress >= 1 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ width: `${Math.round(c.progress * 100)}%` }} />
                        </span>
                        <span className="mt-1 block text-right text-[11px] text-navy-400">{Math.round(c.progress * 100)}%</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <TasksSection tasks={tasks} current={current} onTab={setTab} showCounsellor={false} />
          </>
        }
        rail={
          <>
            <NotificationsSection />
            <SessionsTodaySection sessions={todaysSessions} nameOf={nameOf} showCounsellor={false} />
            <MessagesSection threads={threads} />
          </>
        }
      />
    </>
  );
}
