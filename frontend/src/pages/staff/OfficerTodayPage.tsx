import { useMemo, useState } from 'react';
import { AlarmClock, FileSearch, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUps, useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { Caseload } from '../../components/staff/Caseload';
import { MessagesSection, NotificationsSection, SessionsTodaySection, Stat, StatStrip, TasksSection, TodayColumns, TodayHeader, daySummary, firstTab, splitTasks, unreadThreads, type TaskTab } from '../../components/staff/TodayParts';
import { CASE_GROUPS, DESK, officerCase, type OfficerArea } from '../../lib/officerCase';
import { isoDate } from '../../lib/scheduling';

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

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const showTasks = (t: TaskTab) => {
    setTab(t);
    scrollTo('tasks');
  };

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
            <Caseload cases={cases} groups={CASE_GROUPS[area]} filter={filter} onFilter={setFilter} />
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
