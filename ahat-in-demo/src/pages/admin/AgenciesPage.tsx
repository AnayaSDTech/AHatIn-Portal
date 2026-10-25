import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { demoAgencies } from '../../data/staff';
import { cn, daysUntil, formatDate } from '../../lib/utils';

export function AgenciesPage() {
  return (
    <>
      <PageHeader title="Partner agencies" description="AHat applies to universities through these agencies. Agency logins are never stored in the portal." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy-50/60 text-xs uppercase tracking-wider text-navy-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Agency</th>
              <th className="px-5 py-3 font-semibold">Countries</th>
              <th className="px-5 py-3 font-semibold">AHat's commission share</th>
              <th className="px-5 py-3 font-semibold">Agreement ends</th>
              <th className="px-5 py-3 font-semibold">Applications</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {demoAgencies.map((a) => {
              const days = daysUntil(a.agreementEnd);
              const soon = a.status === 'Active' && days <= 30;
              return (
                <tr key={a.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-navy-900">{a.name}</p>
                    <p className="text-xs text-navy-500">{a.type}</p>
                  </td>
                  <td className="px-5 py-4 text-navy-700">{a.countries}</td>
                  <td className="px-5 py-4 font-semibold text-navy-900">{a.commissionShare}</td>
                  <td className={cn('px-5 py-4', soon ? 'font-semibold text-amber-700' : 'text-navy-700')}>
                    <span className="flex items-center gap-1.5">
                      {soon && <AlertTriangle className="h-4 w-4" aria-hidden />}
                      {formatDate(a.agreementEnd)}
                    </span>
                    {soon && <span className="text-xs">in {days} days</span>}
                  </td>
                  <td className="px-5 py-4 text-navy-700">{a.applications}</td>
                  <td className="px-5 py-4"><Pill tone={a.status === 'Active' ? 'green' : 'grey'}>{a.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-navy-400">Commission shares and agency names are demo data. Admins are warned 30 days before an agreement ends.</p>
    </>
  );
}
