import { useState } from 'react';
import { AlarmClock, ClipboardList, FileSearch, MessageSquare, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUps, useLeads, useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { MessagesSection, SessionsTodaySection, Stat, TasksSection, firstTab, greeting, splitTasks, todayLabel, unreadThreads, type TaskTab } from '../../components/staff/TodayParts';
import { areaOfRole, counsellorName } from '../../data/staff';
import { isoDate } from '../../lib/scheduling';
import { formatDate } from '../../lib/utils';
import { OfficerTodayPage } from './OfficerTodayPage';

/** Financial Aid and Visa Officers get a dashboard for their own part of the journey; everyone else the counsellor one. */
export function TodayPage() {
  const { user } = useAuth();
  const area = areaOfRole(user?.role ?? '');
  return area === 'finance' || area === 'visa' ? <OfficerTodayPage area={area} /> : <CounsellorToday />;
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
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl">
            {greeting()}, {user?.name.split(' ')[0] ?? ''}
          </h1>
          <p className="mt-1 text-sm text-navy-500">{todayLabel()}</p>
        </div>
        {scope.covering.map((g) => (
          <p key={g.id} role="status" className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200" title={g.reason}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> Covering {counsellorName(g.ownerId)} until {formatDate(g.until)}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overdue" value={tasks.overdue.length} icon={AlarmClock} tone="bg-red-50 text-red-600" onClick={() => showTasks('overdue')} />
        <Stat label="Due today" value={tasks.today.length} icon={ClipboardList} tone="bg-amber-50 text-amber-700" onClick={() => showTasks('today')} />
        <Stat label="Documents to check" value={docsToVerify} icon={FileSearch} tone="bg-navy-900 text-gold-300" href="/staff/students" />
        {isCounsellor ? (
          <Stat label="New leads" value={newLeads} icon={UserPlus} tone="bg-sky-50 text-sky-700" href="/staff/leads" />
        ) : (
          <Stat label="Unread messages" value={threads.length} icon={MessageSquare} tone="bg-gold-50 text-gold-700" onClick={() => document.getElementById('messages')?.scrollIntoView({ behavior: 'smooth' })} />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <TasksSection tasks={tasks} current={current} onTab={setTab} showCounsellor={scope.isAdmin} />
        </div>
        <div className="min-w-0 space-y-6 xl:col-span-5">
          <SessionsTodaySection sessions={todaysSessions} nameOf={nameOf} showCounsellor={scope.isAdmin} />
          <MessagesSection threads={threads} />
        </div>
      </div>
    </>
  );
}
