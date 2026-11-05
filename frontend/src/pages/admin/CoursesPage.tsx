import { useRef, useState } from 'react';
import { Download, GraduationCap, Upload } from 'lucide-react';
import { Panel } from '../../components/dashboard/Panel';
import { PageHeader } from '../../components/staff/StaffUi';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { formatDate } from '../../lib/utils';

interface Status {
  total: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

const COLUMNS: [string, string][] = [
  ['university, country, course', 'Required. The names students see.'],
  ['study_level', "Required. Foundation, Diploma, Bachelor's, Master's or PhD."],
  ['study_area', 'Required. One of the study areas used in career plans, such as Computing & IT.'],
  ['intakes, intake_years', 'Months and years separated by ";", such as Sep;Jan;May and 2027;2028.'],
  ['status', 'Required. Open or Closed.'],
  ['duration_months', 'For example 12 or 24.'],
  ['tuition_per_year, currency', 'Required. A number and a code, such as 28500 and GBP.'],
  ['application_fee, avg_scholarship', 'In the same currency. Enter 0 for no application fee. Leave a scholarship blank if unknown.'],
  ['min_qualification', "12th, Bachelor's or Master's. Use 12th for 12th or equivalent. Blank means no requirement."],
  ['min_ug_percent, min_12th_percent', 'Percentages. Blank means no requirement.'],
  ['max_backlogs', 'The most backlogs allowed. Blank means no limit.'],
  ['min_ielts, min_pte, min_toefl, min_duolingo', 'Minimum score for each test accepted.'],
  ['featured', 'Yes to show this university first. Blank or No otherwise.'],
  ['qs_ranking', 'The university\'s rank in the latest QS World University Rankings, such as 150. Leave blank if it isn\'t ranked.'],
  ['source_url', 'Optional. The university web page the figures came from, starting with https://.'],
  ['checked_on', 'Required. When the figures were last checked, such as 2026-11-03.'],
];

/** The course list behind Explore Universities: only what's uploaded here reaches students. */
export function CoursesPage() {
  const [status] = useApi<Status | null>('/admin/courses', null);
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; rows: string[] } | null>(null);

  const save = async (read: () => Promise<string>) => {
    setSaving(true);
    setDone(null);
    setError(null);
    try {
      const csv = await read();
      const r = await mutate(() => api.post<Status>('/admin/courses/import', { csv }), { silent: true });
      setDone(`${r.total} courses saved. Students can see them now.`);
    } catch (err) {
      if (err instanceof ApiError) setError({ message: err.message, rows: err.fieldErrors.csv?.split('\n') ?? [] });
      else setError({ message: 'The file could not be read. Please save it as CSV and try again.', rows: [] });
    } finally {
      setSaving(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (file) void save(() => file.text());
  };

  const loadDemo = () => {
    if (status?.total && !window.confirm('Replace the current course list with the demo list?')) return;
    void save(async () => (await fetch('/course-demo.csv')).text());
  };

  return (
    <>
      <PageHeader title="Courses" description="The course list students search in Explore Universities." />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-5">
          <Panel title="Course list" icon={<GraduationCap className="h-4 w-4" aria-hidden />}>
            {status?.total ? (
              <p className="text-sm text-navy-700" data-course-status>
                <span className="font-semibold text-navy-900">{status.total} courses</span> live, uploaded by {status.updatedBy} on {status.updatedAt ? formatDate(status.updatedAt) : ''}.
              </p>
            ) : (
              <p className="text-sm text-navy-500" data-course-status>
                No courses yet, so students see a "coming soon" message.
              </p>
            )}
            <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-navy-600">
              <li>Download the template and fill it in with verified figures.</li>
              <li>Save it as CSV and upload it here.</li>
            </ol>
            <p className="mt-3 rounded-xl bg-ivory px-3.5 py-2.5 text-xs text-navy-600">Each upload replaces the whole list, so always upload the complete file. If any row has a problem, nothing is saved. Featured and QS ranking must match on every row of a university. Take figures from each university's own website, not from other agencies' lists, and don't add university logos. The demo list has real courses, taken from each university's website on the date shown, so re-check them before each intake.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/course-template.csv" download className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-navy-800 ring-1 ring-navy-200 transition hover:bg-navy-50" data-course-template>
                <Download className="h-4 w-4" aria-hidden /> Download template
              </a>
              <Button size="sm" loading={saving} onClick={() => input.current?.click()} data-course-upload>
                <Upload className="h-4 w-4" aria-hidden /> Upload CSV
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={loadDemo} data-course-demo>
                Load demo list
              </Button>
              <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} data-course-file />
            </div>
            {done && (
              <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {done}
              </p>
            )}
            {error && (
              <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" data-course-errors>
                <p className="font-semibold">{error.message}</p>
                {error.rows.length > 0 && (
                  <ul className="mt-2 max-h-64 list-inside list-disc space-y-0.5 overflow-y-auto text-xs">
                    {error.rows.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>
        </div>
        <div className="min-w-0 xl:col-span-7">
          <Panel title="What goes in each column">
            <dl className="divide-y divide-navy-100">
              {COLUMNS.map(([name, help]) => (
                <div key={name} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <dt className="break-words font-mono text-xs text-navy-800">{name}</dt>
                  <dd className="text-navy-600">{help}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
