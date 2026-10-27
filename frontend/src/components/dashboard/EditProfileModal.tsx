import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { profileSchema, type ProfileForm } from '../../lib/validation';
import type { StudentProfile } from '../../data/dashboard';
import { ApiError } from '../../lib/api/types';

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

const englishTests = toOptions(['IELTS', 'PTE', 'TOEFL', 'Duolingo', 'Not taken yet']);
const destinations = toOptions(['United Kingdom','Germany', 'Ireland', 'France', 'Not sure yet']);
const intakes = toOptions(['January 2027', 'September 2027', 'January 2028', 'September 2028']);
const budgets = toOptions(['Under ₹15 lakh', '₹15–25 lakh', '₹25–35 lakh', '₹35–50 lakh', 'Above ₹50 lakh']);

interface Props {
  open: boolean;
  onClose: () => void;
  profile: StudentProfile;
  name: string;
  email: string;
  passportLocked: boolean;
  onSave: (profile: StudentProfile) => Promise<void>;
  /** The profile isn't complete yet: asks the student to complete it, and why. */
  completing?: boolean;
}

export function EditProfileModal({ open, onClose, profile, name, email, passportLocked, onSave, completing = false }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: profile });

  const [formError, setFormError] = useState<string | null>(null);

  // Start from the saved profile each time the dialog opens, and only then: the dashboard refreshes the record
  // every 30 seconds, and resetting on each refresh would wipe what the student is typing.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(profile);
      setFormError(null);
    }
    wasOpen.current = open;
  }, [open, profile, reset]);

  const test = watch('englishTest');

  const submit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await onSave({ ...data, passportNumber: profile.passportNumber });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) Object.entries(err.fieldErrors).forEach(([field, message]) => setError(field as keyof ProfileForm, { message }));
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={completing ? 'Complete your profile' : 'Edit profile'}
      description={
        completing
          ? 'Your journey starts once your profile is complete: we use it to match you with a counsellor who knows your chosen country and course.'
          : 'Keep your details up to date so your counsellor can advise you accurately.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {completing ? 'Later' : 'Cancel'}
          </Button>
          <Button type="submit" form="profile-form" loading={isSubmitting} disabled={!isDirty}>
            {completing ? 'Save profile' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={submit} noValidate className="space-y-6">
        {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">Personal</legend>
          <TextField label="Full name" value={name} disabled readOnly hint="Contact your counsellor to change your name" />
          <TextField label="Email" value={email} disabled readOnly hint="Your login email" />
          <TextField label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
          <TextField label="City" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
          <div className="sm:col-span-2">
            <TextField
              label="Passport number"
              value={profile.passportNumber}
              disabled
              readOnly
              hint={passportLocked ? 'Locked because it is used in a submitted application. Ask your counsellor to change it.' : undefined}
            />
            {passportLocked && (
              <p className="mt-1 flex items-center gap-1 text-xs text-navy-400">
                <Lock className="h-3 w-3" aria-hidden /> Locked field
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">Education and tests</legend>
          <TextField label="Highest qualification" error={errors.degree?.message} {...register('degree')} />
          <TextField label="College or university" error={errors.institution?.message} {...register('institution')} />
          <TextField label="Grade" placeholder="e.g. 8.4 CGPA or 72%" error={errors.grade?.message} {...register('grade')} />
          <TextField label="Work experience" placeholder="e.g. 2 years · Data Analyst" error={errors.workExperience?.message} {...register('workExperience')} />
          <SelectField label="English test" options={englishTests} error={errors.englishTest?.message} {...register('englishTest')} />
          <TextField
            label="English score"
            inputMode="decimal"
            placeholder={test === 'Not taken yet' ? 'Not needed yet' : 'Overall score'}
            readOnly={test === 'Not taken yet'}
            error={errors.englishScore?.message}
            {...register('englishScore')}
          />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">Study plans</legend>
          <TextField label="Course of interest" error={errors.courseInterest?.message} {...register('courseInterest')} />
          <SelectField label="Preferred destination" options={destinations} error={errors.destination?.message} {...register('destination')} />
          <SelectField label="Preferred intake" options={intakes} error={errors.intake?.message} {...register('intake')} />
          <SelectField label="Budget (total)" options={budgets} error={errors.budget?.message} {...register('budget')} />
        </fieldset>
      </form>
    </Modal>
  );
}
