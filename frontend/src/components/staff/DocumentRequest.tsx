import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { STAGE_DOCUMENTS } from '../../data/documentOptions';
import type { DocCategory, StaffStudent } from '../../data/staff';
import type { ServiceCode } from '../../lib/journey';

const OTHER = 'Other (type the name)';

/**
 * Chooses a document from a list, or "Other" to type its name. Documents already on the student's checklist aren't
 * offered, so one isn't requested twice. `value` is the document's name.
 */
export function DocumentNameField({ label, options, student, value, onChange }: { label: string; options: string[]; student: StaffStudent; value: string; onChange: (name: string) => void }) {
  const [typing, setTyping] = useState(false);
  const onList = new Set(student.documents.map((d) => d.name.toLowerCase()));
  const choices = [...options.filter((o) => !onList.has(o.toLowerCase())), OTHER].map((o) => ({ value: o, label: o }));
  return (
    <>
      <SelectField
        label={label}
        placeholder="Choose a document"
        options={choices}
        value={typing ? OTHER : value}
        onChange={(e) => {
          setTyping(e.target.value === OTHER);
          onChange(e.target.value === OTHER ? '' : e.target.value);
        }}
        data-document-choice
      />
      {typing && <TextField label="Document name" placeholder="e.g. Statement of Purpose (final)" maxLength={150} value={value} onChange={(e) => onChange(e.target.value)} data-document-other />}
    </>
  );
}

/** Requests a document at one stage of the journey. Disabled along with the stage for staff who can only view it. */
export function DocumentRequest({ stage, student, onRequest }: { stage: ServiceCode; student: StaffStudent; onRequest: (name: string, category: DocCategory) => void }) {
  const { category, options } = STAGE_DOCUMENTS[stage];
  const [name, setName] = useState('');
  const [sent, setSent] = useState('');
  // A new field after each request, so "Other" closes again.
  const [round, setRound] = useState(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 3) return;
    onRequest(clean, category);
    setSent(clean);
    setName('');
    setRound((r) => r + 1);
  };

  return (
    <form onSubmit={submit} className="mt-6 border-t border-navy-100 pt-5" data-document-request={stage}>
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-3">
          <DocumentNameField key={round} label="Request a document" options={options} student={student} value={name} onChange={setName} />
        </div>
        <Button type="submit" variant="outline" disabled={name.trim().length < 3}>
          Request
        </Button>
      </div>
      {sent && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {sent} added to the student's checklist. They've been emailed.
        </p>
      )}
    </form>
  );
}
