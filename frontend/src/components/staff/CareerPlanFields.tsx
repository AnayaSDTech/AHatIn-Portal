import { useId } from 'react';
import { Check } from 'lucide-react';
import { SelectField } from '../ui/FormField';
import { useApi } from '../../lib/api/store';
import type { CareerPlan, CareerPlanInput } from '../../lib/journey';
import { cn } from '../../lib/utils';

/** Choices for the career plan, from the backend (one list for the whole portal). */
export interface CareerOptions {
  directions: { key: string; label: string; courses: string[] }[];
  levels: { key: string; label: string }[];
  destinations: string[];
  /** The "Other (describe in notes)" course offered in every direction. */
  otherCourse: string;
}

const NO_OPTIONS: CareerOptions = { directions: [], levels: [], destinations: [], otherCourse: '' };

export const useCareerOptions = () => useApi<CareerOptions>('/career-options', NO_OPTIONS)[0];

export const emptyCareerPlan = (): CareerPlanInput => ({ direction: '', course: '', level: '', destinations: [], notes: '' });

/** The form's starting values: the saved choices, or (for a plan recorded as free text) that text in the notes. */
export function careerPlanDraft(plan?: CareerPlan): CareerPlanInput {
  if (!plan) return emptyCareerPlan();
  if (!plan.direction) return { ...emptyCareerPlan(), notes: plan.summary };
  return { direction: plan.direction, course: plan.course ?? '', level: plan.level ?? '', destinations: plan.destinations ?? [], notes: plan.notes ?? '' };
}

/** What's missing, in the same words the server uses; null when the plan can be saved. */
export function careerPlanError(d: CareerPlanInput, options: CareerOptions): string | null {
  if (!d.direction) return 'Choose a career direction.';
  if (!d.course) return 'Choose a preferred course.';
  if (!d.level) return 'Choose a study level.';
  if (!d.destinations.length) return 'Choose at least one study destination.';
  if (d.course === options.otherCourse && d.notes.trim().length < 3) return 'Describe the course in the notes when choosing “Other”.';
  return null;
}

/** Career direction → course (only that direction's courses), study level, destinations and notes. */
export function CareerPlanFields({ value, onChange }: { value: CareerPlanInput; onChange: (v: CareerPlanInput) => void }) {
  const options = useCareerOptions();
  const notesId = useId();
  const direction = options.directions.find((d) => d.key === value.direction);
  const set = (patch: Partial<CareerPlanInput>) => onChange({ ...value, ...patch });

  const toggleDestination = (country: string) =>
    set({ destinations: value.destinations.includes(country) ? value.destinations.filter((c) => c !== country) : [...value.destinations, country] });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Career direction"
          placeholder="Choose a direction"
          options={options.directions.map((d) => ({ value: d.key, label: d.label }))}
          value={value.direction}
          // A course only makes sense within its direction, so a new direction clears it.
          onChange={(e) => set({ direction: e.target.value, course: '' })}
        />
        <SelectField
          label="Preferred course"
          placeholder={direction ? 'Choose a course' : 'Choose a career direction first'}
          options={(direction?.courses ?? []).map((c) => ({ value: c, label: c }))}
          value={value.course}
          disabled={!direction}
          onChange={(e) => set({ course: e.target.value })}
        />
        <SelectField
          label="Study level"
          placeholder="Choose a level"
          options={options.levels.map((l) => ({ value: l.key, label: l.label }))}
          value={value.level}
          onChange={(e) => set({ level: e.target.value })}
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-navy-800">Preferred study destinations</legend>
        <div className="flex flex-wrap gap-2">
          {options.destinations.map((country) => {
            const on = value.destinations.includes(country);
            return (
              <button
                key={country}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleDestination(country)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  on ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100 hover:ring-navy-300',
                )}
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                {country}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-navy-400">Choose one or more, most preferred first.</p>
      </fieldset>

      <div>
        <label htmlFor={notesId} className="mb-1.5 block text-sm font-medium text-navy-800">
          Additional notes <span className="font-normal text-navy-400">(optional)</span>
        </label>
        <textarea
          id={notesId}
          rows={2}
          maxLength={1000}
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="input resize-none"
          placeholder={value.course === options.otherCourse ? 'Describe the course, e.g. Occupational therapy' : 'e.g. UK first; Ireland as a back-up'}
        />
      </div>
    </div>
  );
}
