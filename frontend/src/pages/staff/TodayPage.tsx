import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, ClipboardList, FileSearch, MessageSquare, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUps, useLeads, useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { MessagesSection, NotificationsSection, SessionsTodaySection, Stat, StatStrip, TasksSection, TodayColumns, TodayHeader, daySummary, firstTab, splitTasks, unreadThreads, type TaskTab } from '../../components/staff/TodayParts';
import { areaOfRole, counsellorName, type StaffStudent } from '../../data/staff';
import { isoDate } from '../../lib/scheduling';
import { formatDate, initials, relativeTime } from '../../lib/utils';
import { OfficerTodayPage } from './OfficerTodayPage';

/** Financial Aid and Visa Officers get a dashboard for their own part of the journey; everyone else the counsellor one. */
export function TodayPage() {
  const { user } = useAuth();
  const area = areaOfRole(user?.role ?? '');
  return area === 'finance' || area === 'visa' ? <OfficerTodayPage area={area} /> : <CounsellorToday />;
}

/** Students just assigned to the counsellor; each stays here until its record is opened. */
function NewStudents({ students }: { students: StaffStudent[] }) {
  return (
    <section className="card overflow-hidden ring-1 ring-gold-300" aria-label="New students" data-new-students>
      <header className="flex items-center justify-between gap-3 border-b border-gold-200 bg-gold-50 px-5 py-4">
        <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-navy-900">
          <UserPlus className="h-4 w-4 text-gold-700" aria-hidden /> New students · {students.length}
        </h2>
        <p className="hidden text-xs text-navy-500 sm:block">Assigned to you. Open each profile to get started.</p>
      </header>
      <ul className="divide-y divide-navy-100">
        {students.map((s) => (
          <li key={s.id}>
            <Link to={`/staff/students/${s.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-ivory/60" data-new-student={s.id}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-gold-300">{initials(s.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm font-semibold text-navy-900 group-hover:text-gold-700">{s.name}</span>
                  <span className="text-xs text-navy-400">{s.reference}</span>
                </span>
                <span className="block truncate text-xs text-navy-500">{[s.goal, s.destination, s.intake].filter((x) => x && !/^(To be decided|Not decided)$/.test(x)).join(' · ')}</span>
              </span>
              {s.counsellorAssignedAt && <span className="hidden shrink-0 text-xs text-navy-400 sm:block">Assigned {relativeTime(s.counsellorAssignedAt)}</span>}
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-navy-700 group-hover:text-gold-700">
                Open profile <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CounsellorToday() {
  const { user } = useAuth();
  const scope = useStaffScope();
  const [allFollowUps] = useFollowUps();
  const [allLeads] = useLeads();
  const [allStudents] = useStaffStudents();
  const [sessions] = useSessions();
  const [messages] = useMessages();

  // Only the follow-ups, leads and students this person may see.
  const followUps = allFollowUps.filter((f) => scope.canSee(f.counsellorId));
  const leads = allLeads.filter((l) => scope.canSee(l.counsellorId));
  const students = scope.filterStudents(allStudents);
  const todayIso = isoDate(new Date());
  const todaysSessions = sessions
    .filter((s) => s.date === todayIso && s.status !== 'cancelled' && (scope.isAdmin || s.counsellorId === scope.myId))
    .sort((a, b) => a.time.localeCompare(b.time));
  const nameOf = (id: string) => allStudents.find((s) => s.id === id)?.name ?? 'Student';
  const threads = unreadThreads(students, messages);
  // Newly assigned to this counsellor and not opened yet (newest first).
  const newStudents = students
    .filter((s) => s.newForCounsellor && s.counsellorId === scope.myId)
    .sort((a, b) => (b.counsellorAssignedAt ?? '').localeCompare(a.counsellorAssignedAt ?? ''));

  const tasks = splitTasks(followUps);
  const [tab, setTab] = useState<TaskTab | null>(null);
  const current: TaskTab = tab ?? firstTab(tasks);
  const newLeads = leads.filter((l) => l.stage === 'new_lead').length;
  const docsToVerify = students.reduce((n, s) => n + s.documents.filter((d) => d.state === 'pending').length, 0);
  const isCounsellor = user?.role === 'counsellor' || user?.role === 'admin';

  const showTasks = (t: TaskTab) => {
    setTab(t);
    document.getElementById('tasks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <TodayHeader name={user?.name ?? ''} summary={daySummary(tasks.overdue.length, tasks.today.length, todaysSessions.length)}>
        {scope.covering.map((g) => (
          <p key={g.id} role="status" className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200" title={g.reason}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> Covering {counsellorName(g.ownerId)} until {formatDate(g.until)}
          </p>
        ))}
      </TodayHeader>

      <StatStrip>
        <Stat label="Overdue" value={tasks.overdue.length} icon={AlarmClock} tone="bg-red-50 text-red-600" onClick={() => showTasks('overdue')} />
        <Stat label="Due today" value={tasks.today.length} icon={ClipboardList} tone="bg-amber-50 text-amber-700" onClick={() => showTasks('today')} />
        <Stat label="Documents to check" value={docsToVerify} icon={FileSearch} tone="bg-navy-900 text-gold-300" href="/staff/students" />
        {isCounsellor ? (
          <Stat label="New leads" value={newLeads} icon={UserPlus} tone="bg-sky-50 text-sky-700" href="/staff/leads" />
        ) : (
          <Stat label="Unread messages" value={threads.length} icon={MessageSquare} tone="bg-gold-50 text-gold-700" onClick={() => document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth' })} />
        )}
      </StatStrip>

      <TodayColumns
        main={
          <>
            {newStudents.length > 0 && <NewStudents students={newStudents} />}
            <TasksSection tasks={tasks} current={current} onTab={setTab} showCounsellor={scope.isAdmin} />
          </>
        }
        rail={
          <>
            <NotificationsSection />
            <SessionsTodaySection sessions={todaysSessions} nameOf={nameOf} showCounsellor={scope.isAdmin} />
            <MessagesSection threads={threads} />
          </>
        }
      />
    </>
  );
}
