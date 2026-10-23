import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { profileSchema, type ProfileForm } from '../../lib/validation';
import type { StudentProfile } from '../../data/dashboard';

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
  onSave: (profile: StudentProfile) => void;
}

export function EditProfileModal({ open, onClose, profile, name, email, passportLocked, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: profile });

  // Start from the saved profile each time the dialog opens.
  useEffect(() => {
    if (open) reset(profile);
  }, [open, profile, reset]);

  const test = watch('englishTest');

  const submit = handleSubmit(async (data) => {
    await new Promise((r) => setTimeout(r, 500)); // simulated save
    onSave({ ...data, passportNumber: profile.passportNumber });
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit profile"
      description="Keep your details up to date so your counsellor can advise you accurately."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="profile-form" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={submit} noValidate className="space-y-6">
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
