import { Link } from 'react-router-dom';
import { AlarmClock, AlertTriangle, BarChart3, Megaphone, Percent, ShieldCheck, UsersRound } from 'lucide-react';
import { PageHeader, StatCard } from '../../components/staff/StaffUi';
import { Panel } from '../../components/dashboard/Panel';
import type { Overview } from '../../data/staff';
import { useApi } from '../../lib/api/store';
import { cn, daysUntil, formatDate } from '../../lib/utils';

const EMPTY: Overview = { funnel: [], leadSources: [], counsellorWorkload: [], agencies: [] };
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

export function AdminOverviewPage() {
  // Worked out by the server from the live records.
  const [{ funnel, leadSources, counsellorWorkload, agencies }, loaded] = useApi<Overview>('/admin/overview', EMPTY, { pollMs: 120_000 });
  if (!loaded) return null;
  const count = (stage: string) => funnel.find((f) => f.stage === stage)?.count ?? 0;
  const enquiries = funnel[0]?.count ?? 0;
  const registered = count('Registered');
  const visa = count('Visa granted');
  const accepted = count('Offer accepted');
  const overdue = counsellorWorkload.reduce((n, c) => n + c.overdue, 0);
  const maxSource = Math.max(1, ...leadSources.map((s) => s.count));
  const expiring = agencies.filter((a) => a.status === 'Active' && daysUntil(a.agreementEnd) <= 30);

  return (
    <>
      <PageHeader title="Overview" description="Last 12 months, all counsellors." />

      {expiring.map((a) => (
        <div key={a.id} role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">{a.name}</span>: agreement ends on {formatDate(a.agreementEnd)} ({daysUntil(a.agreementEnd)} days).{' '}
            <Link to="/admin/agencies" className="font-semibold underline underline-offset-4">Review agencies</Link>
          </p>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enquiries" value={enquiries} icon={Megaphone} tone="blue" />
        <StatCard label="Enquiry → registered" value={`${pct(registered, enquiries)}%`} icon={Percent} tone="green" note="Target 15–20%" />
        <StatCard label="Visa success" value={`${pct(visa, accepted)}%`} icon={ShieldCheck} tone="green" note="Target 90%+" />
        <StatCard label="Overdue follow-ups" value={overdue} icon={AlarmClock} tone={overdue ? 'red' : 'green'} note="Across all counsellors" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel title="Student funnel" icon={<BarChart3 className="h-4 w-4" aria-hidden />} className="min-w-0 xl:col-span-7">
          <ul className="space-y-3">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1]!.count : null;
              return (
                <li key={f.stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-navy-800">{f.stage}</span>
                    <span className="text-navy-500">
                      <span className="font-semibold text-navy-900">{f.count}</span>
                      {prev !== null && <span className="ml-2 text-xs">{pct(f.count, prev)}% of previous</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-navy-50">
                    <div
                      className={cn('h-full rounded-full', f.stage === 'Registered' ? 'bg-gold-500' : 'bg-navy-700')}
                      style={{ width: `${pct(f.count, enquiries)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-navy-400">Bars are to scale against enquiries. Registration (gold) is where most enquiries drop out.</p>
        </Panel>

        <Panel title="Enquiries by source" icon={<Megaphone className="h-4 w-4" aria-hidden />} className="min-w-0 xl:col-span-5">
          <ul className="space-y-3">
            {leadSources.map((s) => (
              <li key={s.source} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-navy-700">{s.source}</span>
                  <span className="font-semibold text-navy-900">{s.count}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-50">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Counsellor workload" icon={<UsersRound className="h-4 w-4" aria-hidden />} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-navy-500">
              <tr className="border-b border-navy-100">
                <th className="py-3 pr-4 font-semibold">Counsellor</th>
                <th className="px-4 py-3 font-semibold">Active students</th>
                <th className="px-4 py-3 font-semibold">Open leads</th>
                <th className="px-4 py-3 font-semibold">Overdue</th>
                <th className="px-4 py-3 font-semibold">Median first reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {counsellorWorkload.map((c) => (
                <tr key={c.id}>
                  <td className="py-3.5 pr-4 font-semibold text-navy-900">{c.name}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-navy-50">
                        <div className={cn('h-full rounded-full', c.activeStudents > 32 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (c.activeStudents / 40) * 100)}%` }} />
                      </div>
                      {c.activeStudents} / 40
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-navy-700">{c.openLeads}</td>
                  <td className={cn('px-4 py-3.5 font-semibold', c.overdue ? 'text-red-600' : 'text-emerald-600')}>{c.overdue}</td>
                  <td className={cn('px-4 py-3.5', (c.medianResponse ?? 0) > 15 ? 'font-semibold text-red-600' : 'text-navy-700')}>
                    {c.medianResponse === null ? '—' : `${c.medianResponse} min`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-navy-400">Capacity 40 students per counsellor. First-reply target: 15 minutes in working hours.</p>
      </Panel>
    </>
  );
}
