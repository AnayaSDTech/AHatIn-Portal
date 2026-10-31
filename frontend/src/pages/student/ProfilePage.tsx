import { useEffect, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, GraduationCap, KeyRound, Lock, Mail, MapPin, Pencil, Phone, Plus, ShieldCheck, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import { Panel } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { ComboField, SelectField, TextField } from '../../components/ui/FormField';
import { useCareerOptions } from '../../components/staff/CareerPlanFields';
import { useStudent } from '../../components/student/StudentLayout';
import { GENDERS, MAX_COURSES, isProfileComplete, type StudentProfile } from '../../data/dashboard';
import { CITIES_BY_STATE, HSC_BOARDS, HSC_STREAMS, INDIAN_INSTITUTIONS, INDIAN_STATES, OTHER_QUALIFICATION, QUALIFICATIONS, SCHOOL_QUALIFICATION, SPECIALISATIONS, SSC_BOARDS, yearsBack } from '../../data/profileOptions';
import { api } from '../../lib/api/client';
import { mutate } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { changePasswordSchema, cleanMobile, profileSchema, type ChangePasswordForm, type ProfileForm } from '../../lib/validation';
import { useAuth } from '../../context/AuthContext';
import { cn, formatDate, initials } from '../../lib/utils';

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));
const genders = toOptions(GENDERS);
const englishTests = toOptions(['IELTS', 'PTE', 'TOEFL', 'Duolingo', 'Not taken yet']);
const destinations = toOptions(['United Kingdom', 'Germany', 'Ireland', 'France', 'Not sure yet']);
const intakes = toOptions(['January 2027', 'September 2027', 'January 2028', 'September 2028']);
const budgets = toOptions(['Under ₹15 lakh', '₹15–25 lakh', '₹25–35 lakh', '₹35–50 lakh', 'Above ₹50 lakh']);
const states = toOptions(INDIAN_STATES);
const sscBoards = toOptions(SSC_BOARDS);
const hscBoards = toOptions(HSC_BOARDS);
const hscStreams = toOptions(HSC_STREAMS);
const schoolYears = toOptions(yearsBack());
// The highest qualification may still be in progress: its expected year.
const degreeYears = toOptions(yearsBack(6));
const ALL_CITIES = Array.from(new Set(Object.values(CITIES_BY_STATE).flat())).sort();

/** The parts of the profile; each has its own card in the summary and in the form. */
type Part = 'personal' | 'address' | 'study' | 'education';

const showMobile = (ten: string) => (ten.length === 10 ? `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` : ten);

/**
 * "My profile": a summary of the student's details, and the form to change them on the same page.
 * Until the profile is complete it opens on the form, since the journey starts (and a counsellor is matched) once it is.
 */
export function ProfilePage() {
  const { user, profile, profileComplete, counsellor, record } = useStudent();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editing = !profileComplete || params.get('edit') === '1';
  const [saved, setSaved] = useState<'saved' | 'completed' | null>(null);
  // Where to scroll once the page switches between the summary and the form: the part being edited, not the page top.
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const [part, setPart] = useState<Part | null>(null);
  useEffect(() => {
    if (!scrollTo) return;
    requestAnimationFrame(() => document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    setScrollTo(null);
  }, [scrollTo, editing]);

  /** Opens the form at one part (or at its start), or goes back to the summary at the part that was being edited. */
  const setEditing = (on: boolean, at: Part | null = null) => {
    setSaved(null);
    setPart(at);
    setParams(on ? { edit: '1' } : {}, { replace: true });
    setScrollTo(on ? (at ? `edit-${at}` : 'edit-form') : part ? `profile-${part}` : 'profile-top');
  };

  if (editing) {
    return (
      <ProfileEditor
        // A fresh form each time editing starts (the record refreshes every 30 seconds; this keeps what is typed).
        key={params.get('edit') ?? 'completing'}
        profile={profile}
        name={user.name}
        email={user.email}
        completing={!profileComplete}
        onCancel={() => (profileComplete ? setEditing(false) : navigate('/dashboard'))}
        onSaved={(nowComplete) => {
          setParams({}, { replace: true });
          setSaved(!profileComplete && nowComplete ? 'completed' : 'saved');
          // Back to the top of the summary, where the "saved" message is.
          setScrollTo('profile-top');
        }}
      />
    );
  }

  const passportLocked = record.applications.some((a) => a.state !== 'draft');
  const english = !profile.englishTest || profile.englishTest === 'Not taken yet' ? profile.englishTest : `${profile.englishTest} · ${profile.englishScore}`;
  const ordinal = ['1st choice', '2nd choice', '3rd choice'];
  const schoolHighest = profile.degree === SCHOOL_QUALIFICATION;
  const hscDetails = <Schooling main={[profile.hscBoard, profile.hscStream].filter(Boolean).join(' · ')} sub={profile.hscCollege} year={profile.hscYear} score={profile.hscScore} />;
  const hasSsc = !!(profile.sscBoard || profile.sscSchool || profile.sscYear || profile.sscScore);
  const hasHsc = !!(profile.hscBoard || profile.hscStream || profile.hscCollege || profile.hscYear || profile.hscScore);

  return (
    <div id="profile-top" className="scroll-mt-28 space-y-6" data-profile-page>
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {saved === 'completed'
            ? counsellor
              ? 'Profile complete. You can now book sessions with your counsellor.'
              : "Profile complete. We're matching you with a counsellor and will email you when they're assigned."
            : 'Your changes are saved.'}
        </p>
      )}

      {/* Who they are, at a glance */}
      <section className="card overflow-hidden" aria-label="Account" data-profile-header>
        <div className="h-20 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 sm:h-24" aria-hidden />
        <div className="px-5 pb-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <span className="-mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 font-display text-2xl text-navy-950 shadow-lift ring-4 ring-white sm:-mt-12 sm:h-24 sm:w-24 sm:text-3xl">
              {initials(user.name)}
            </span>
            <Button onClick={() => setEditing(true)} size="sm" className="mt-4" data-edit-profile>
              <Pencil className="h-4 w-4" aria-hidden /> Edit profile
            </Button>
          </div>
          <div className="mt-3 min-w-0">
            <h2 className="font-display text-2xl text-navy-900 sm:text-3xl">{user.name}</h2>
            <p className="mt-0.5 text-sm text-navy-500">Student{record.reference && <> · Ref. {record.reference}</>}</p>
          </div>

          <div className="mt-6 grid gap-4 border-t border-navy-100 pt-5 sm:grid-cols-2">
            <Contact icon={Mail} label="Email" value={user.email} />
            <Contact icon={Phone} label="Mobile" value={profile.mobile ? showMobile(profile.mobile) : ''} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Section id="profile-personal" title="Personal details" icon={UserRound} onEdit={() => setEditing(true, 'personal')}>
            <Row label="Date of birth">{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : ''}</Row>
            <Row label="Gender">{profile.gender}</Row>
            <Row label="Mobile number">{profile.mobile ? showMobile(profile.mobile) : ''}</Row>
            <Row
              label="Passport number"
              note={
                passportLocked ? (
                  <>
                    <Lock className="h-3 w-3" aria-hidden /> Locked: used in a submitted application
                  </>
                ) : (
                  'Added by your counsellor'
                )
              }
            >
              {profile.passportNumber}
            </Row>
          </Section>

          <Section id="profile-address" title="Permanent address" icon={MapPin} onEdit={() => setEditing(true, 'address')}>
            <Row label="Address">
              {profile.addressLine1 ? (
                <span className="block">
                  {profile.addressLine1}
                  {profile.addressLine2 && <span className="block">{profile.addressLine2}</span>}
                </span>
              ) : (
                ''
              )}
            </Row>
            <Row label="City or town">{profile.city}</Row>
            <Row label="State">{profile.state}</Row>
            <Row label="PIN code">{profile.pincode}</Row>
          </Section>

          <Section id="profile-study" title="Study plans" icon={BookOpen} onEdit={() => setEditing(true, 'study')}>
            <Row label={profile.courseInterests.length > 1 ? 'Courses of interest' : 'Course of interest'}>
              {profile.courseInterests.length ? (
                <ol className="space-y-2" data-courses>
                  {profile.courseInterests.map((c, i) => (
                    <li key={c} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-semibold text-navy-900">{c}</span>
                      {profile.courseInterests.length > 1 && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', i === 0 ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-500')}>{ordinal[i]}</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                ''
              )}
            </Row>
            <Row label="Preferred destination">{profile.destination}</Row>
            <Row label="Preferred intake">{profile.intake}</Row>
            <Row label="Budget (total)">{profile.budget}</Row>
          </Section>

          <Section id="profile-education" title="Education and tests" icon={GraduationCap} onEdit={() => setEditing(true, 'education')}>
            <Row label="Highest qualification">
              {schoolHighest ? (
                <Schooling main={[SCHOOL_QUALIFICATION, profile.hscBoard, profile.hscStream].filter(Boolean).join(' · ')} sub={profile.hscCollege} year={profile.hscYear} score={profile.hscScore} />
              ) : profile.degree ? (
                <Schooling main={[profile.degree, profile.degreeSubject].filter(Boolean).join(' · ')} sub={profile.institution} year={profile.graduationYear} score={profile.grade} />
              ) : (
                ''
              )}
            </Row>
            {hasHsc && !schoolHighest && <Row label="12th (HSC) or diploma">{hscDetails}</Row>}
            {hasSsc && (
              <Row label="10th (SSC)">
                <Schooling main={[profile.sscBoard, profile.sscSchool].filter(Boolean).join(' · ')} year={profile.sscYear} score={profile.sscScore} />
              </Row>
            )}
            <Row label="Work experience">{profile.workExperience}</Row>
            <Row label="English test">{english}</Row>
          </Section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section className="card p-6" aria-label="Your counsellor" data-profile-counsellor>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Your counsellor</p>
            {counsellor ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-bold text-gold-300">{initials(counsellor.name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{counsellor.name}</p>
                    <p className="truncate text-xs text-navy-500">{counsellor.email}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={`mailto:${counsellor.email}`} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-navy-50 px-3 py-2 text-xs font-semibold text-navy-800 transition hover:bg-navy-100">
                    <Mail className="h-3.5 w-3.5" aria-hidden /> Email
                  </a>
                  <a
                    href={`tel:${counsellor.phone.replace(/\s/g, '')}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-navy-50 px-3 py-2 text-xs font-semibold text-navy-800 transition hover:bg-navy-100"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden /> Call
                  </a>
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-ivory p-3.5 text-sm text-navy-600">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                We're matching you with a counsellor who knows {profile.destination && profile.destination !== 'Not sure yet' ? profile.destination : 'your chosen country'}, and will email you when they're assigned.
              </div>
            )}
          </section>

          <PasswordCard />

          <section className="rounded-2xl bg-navy-900 p-6 text-sm text-navy-100" aria-label="Good to know">
            <p className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-gold-400" aria-hidden /> Good to know
            </p>
            <ul className="mt-3 space-y-2.5 text-navy-200">
              <li>Your counsellor sees these details and uses them to plan your applications.</li>
              <li>To change your name or login email, ask {counsellor ? counsellor.name.split(' ')[0] : 'your counsellor'}.</li>
              <li>Your passport number is added by your counsellor and stored encrypted.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Change password: the current one, then the new one twice. Other devices are signed out. */
function PasswordCard() {
  const { changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', password: '', confirmPassword: '' } });

  const close = () => {
    setOpen(false);
    setFormError(null);
    reset();
  };
  const onSubmit = handleSubmit(async ({ currentPassword, password }) => {
    setFormError(null);
    try {
      await changePassword(currentPassword, password);
      close();
      setDone(true);
    } catch (err) {
      const fields = err instanceof ApiError ? Object.entries(err.fieldErrors) : [];
      fields.forEach(([field, message]) => setError((field === 'newPassword' ? 'password' : field) as keyof ChangePasswordForm, { message }));
      // A message under the field is enough; the box above is for anything else.
      if (!fields.length) setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  return (
    <section className="card p-6" aria-label="Password" data-password-card>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
          <KeyRound className="h-4 w-4" aria-hidden /> Password
        </p>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy-600 transition hover:bg-navy-50 hover:text-navy-900"
            data-change-password
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Change
          </button>
        )}
      </div>
      {done && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Password changed. Other devices have been signed out.
        </p>
      )}
      {!open ? (
        !done && <p className="mt-2 text-sm text-navy-500">You log in with your email and password.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4" data-password-form>
          {formError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <TextField label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <TextField label="New password" type="password" autoComplete="new-password" hint="At least 8 characters, with letters and numbers" error={errors.password?.message} {...register('password')} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Save password
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** One stage of schooling in the summary: what, where, and the year and result. */
function Schooling({ main, sub, year, score }: { main: string; sub?: string; year?: string; score?: string }) {
  const meta = [year && `Passed ${Number(year) > new Date().getFullYear() ? `(expected) ${year}` : year}`, score].filter(Boolean).join(' · ');
  return (
    <span className="block">
      <span className="block">{main}</span>
      {sub && <span className="block text-sm font-normal text-navy-600">{sub}</span>}
      {meta && <span className="block text-xs font-normal text-navy-400">{meta}</span>}
    </span>
  );
}

function Contact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ivory text-navy-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-navy-400">{label}</span>
        <span className={cn('block truncate text-sm font-medium', value ? 'text-navy-900' : 'text-navy-300')}>{value || 'Not set'}</span>
      </span>
    </div>
  );
}

/** A card with a title and an Edit link, holding label/value rows. */
function Section({ id, title, icon: Icon, onEdit, children }: { id: string; title: string; icon: LucideIcon; onEdit: () => void; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-28 overflow-hidden" aria-label={title}>
      <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h2>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy-600 transition hover:bg-navy-50 hover:text-navy-900">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </button>
      </header>
      <dl className="divide-y divide-navy-100">{children}</dl>
    </section>
  );
}

function Row({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  const empty = children === '' || children == null;
  return (
    <div className="grid gap-1 px-5 py-3.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4 sm:px-6">
      <dt className="text-navy-500">{label}</dt>
      <dd>
        <span className={empty ? 'text-navy-300' : 'font-medium text-navy-900'}>{empty ? 'Not added' : children}</span>
        {note && <span className="mt-0.5 flex items-center gap-1 text-xs text-navy-400">{note}</span>}
      </dd>
    </div>
  );
}

/* ------------------------------ Editing ------------------------------ */

/** A titled group of fields inside a form card (e.g. "10th (SSC)"). */
function FormGroup({ title, optional = false, last = false, children }: { title: string; optional?: boolean; last?: boolean; children: ReactNode }) {
  return (
    <fieldset className={cn(!last && 'mb-6 border-b border-navy-100 pb-6')}>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">
        {title}
        {optional && <span className="ml-1.5 font-medium normal-case tracking-normal text-navy-300">(optional)</span>}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** One extra qualification in the form, which can be taken out again. */
function QualificationCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-100 p-4" data-qualification={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="font-sans text-sm font-semibold text-navy-900">{title}</h4>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-navy-500 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${title}`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

const HSC_FIELDS = ['hscBoard', 'hscStream', 'hscCollege', 'hscYear', 'hscScore'] as const;
const SSC_FIELDS = ['sscBoard', 'sscSchool', 'sscYear', 'sscScore'] as const;

function toForm(p: StudentProfile): ProfileForm {
  // With the 12th as the highest qualification the degree fields only repeat it (older profiles may only have those).
  const school = p.degree === SCHOOL_QUALIFICATION;
  return {
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    mobile: p.mobile,
    addressLine1: p.addressLine1 ?? '',
    addressLine2: p.addressLine2 ?? '',
    city: p.city,
    // Only a state from the list (older profiles had none).
    state: INDIAN_STATES.includes(p.state) ? p.state : '',
    pincode: p.pincode ?? '',
    sscBoard: p.sscBoard ?? '',
    sscSchool: p.sscSchool ?? '',
    sscYear: p.sscYear ?? '',
    sscScore: p.sscScore ?? '',
    hscBoard: p.hscBoard ?? '',
    hscStream: p.hscStream ?? '',
    hscCollege: p.hscCollege || (school ? p.institution : ''),
    hscYear: p.hscYear || (school ? (p.graduationYear ?? '') : ''),
    hscScore: p.hscScore || (school ? p.grade : ''),
    degree: p.degree,
    degreeSubject: school ? '' : (p.degreeSubject ?? ''),
    institution: school ? '' : p.institution,
    graduationYear: school ? '' : (p.graduationYear ?? ''),
    grade: school ? '' : p.grade,
    englishTest: p.englishTest || 'Not taken yet',
    englishScore: p.englishScore,
    workExperience: p.workExperience,
    courseInterests: (p.courseInterests.length ? p.courseInterests : ['']).map((value) => ({ value })),
    destination: p.destination,
    intake: p.intake,
    budget: p.budget,
  };
}

function ProfileEditor({
  profile,
  name,
  email,
  completing,
  onCancel,
  onSaved,
}: {
  profile: StudentProfile;
  name: string;
  email: string;
  completing: boolean;
  onCancel: () => void;
  onSaved: (nowComplete: boolean) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: toForm(profile) });
  const courses = useFieldArray({ control, name: 'courseInterests' });
  const [formError, setFormError] = useState<string | null>(null);
  const test = watch('englishTest');
  const state = watch('state');
  const degree = watch('degree');
  const schoolHighest = degree === SCHOOL_QUALIFICATION;
  const otherDegree = degree === OTHER_QUALIFICATION;
  // A qualification the student named earlier stays selectable.
  const qualifications = toOptions([...QUALIFICATIONS, ...(profile.degree && !QUALIFICATIONS.includes(profile.degree) ? [profile.degree] : []), OTHER_QUALIFICATION]);
  // The 10th and 12th are optional: their fields show once added (or if already filled in).
  const [added, setAdded] = useState(() => {
    const form = toForm(profile);
    return { hsc: HSC_FIELDS.some((f) => form[f]), ssc: SSC_FIELDS.some((f) => form[f]) };
  });
  const [choosing, setChoosing] = useState(false);
  // Moving on from the 12th as the highest qualification keeps what was entered, as an extra qualification.
  useEffect(() => {
    if (schoolHighest) setAdded((a) => ({ ...a, hsc: true }));
  }, [schoolHighest]);
  const addable = [
    ...(!schoolHighest && !added.hsc ? [{ key: 'hsc' as const, label: '12th (HSC) or diploma' }] : []),
    ...(!added.ssc ? [{ key: 'ssc' as const, label: '10th (SSC)' }] : []),
  ];
  const removeQualification = (key: 'hsc' | 'ssc') => {
    (key === 'hsc' ? HSC_FIELDS : SSC_FIELDS).forEach((f) => setValue(f, '', { shouldDirty: true }));
    setAdded((a) => ({ ...a, [key]: false }));
  };
  const hscFields = (highest: boolean) => (
    <>
      <SelectField label="Board" required={highest} placeholder="Choose your board" options={hscBoards} error={errors.hscBoard?.message} {...register('hscBoard')} />
      <SelectField label={highest ? 'Stream (optional)' : 'Stream'} placeholder="Choose your stream" options={hscStreams} error={errors.hscStream?.message} {...register('hscStream')} />
      <TextField label="Junior college or school" required={highest} placeholder="College name and town" error={errors.hscCollege?.message} {...register('hscCollege')} />
      <SelectField
        label={highest ? 'Year of passing (or expected)' : 'Year of passing'}
        required={highest}
        placeholder="Choose year"
        options={degreeYears}
        error={errors.hscYear?.message}
        {...register('hscYear')}
      />
      <TextField label={highest ? 'Percentage or CGPA (optional)' : 'Percentage or CGPA'} placeholder="e.g. 82%" error={errors.hscScore?.message} {...register('hscScore')} />
    </>
  );
  // Course suggestions: the same courses counsellors use for career plans.
  const careerOptions = useCareerOptions();
  const courseSuggestions = careerOptions.directions.flatMap((d) => d.courses).filter((c) => c !== careerOptions.otherCourse);

  const submit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const res = await mutate(
        () =>
          api.put<StudentProfile>('/me/profile', {
            ...data,
            // A qualification that isn't listed is saved under the name the student gave it.
            ...(data.degree === OTHER_QUALIFICATION ? { degree: data.degreeSubject, degreeSubject: '' } : {}),
            mobile: cleanMobile(data.mobile),
            courseInterests: data.courseInterests.map((c) => c.value.trim()),
          }),
        { silent: true },
      );
      onSaved(isProfileComplete(res));
    } catch (err) {
      if (err instanceof ApiError) {
        Object.entries(err.fieldErrors).forEach(([field, message]) => setError((field === 'courseInterest' ? 'courseInterests' : field) as keyof ProfileForm, { message }));
      }
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  return (
    <form id="edit-form" onSubmit={submit} noValidate className="scroll-mt-28 space-y-6" data-profile-form>
      {completing && (
        <div className="rounded-2xl border border-gold-300 bg-gold-50 p-5 text-sm text-navy-800">
          <p className="font-semibold text-navy-900">Complete your profile to start your journey</p>
          <p className="mt-1">We use it to match you with a counsellor who knows your chosen country and courses. It takes about five minutes.</p>
        </div>
      )}
      {formError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      <p className="text-xs text-navy-500" data-required-note>
        Fields marked <span className="font-semibold text-red-600">*</span> are required.
      </p>

      <Panel id="edit-personal" title="Personal details" icon={<UserRound className="h-4 w-4" aria-hidden />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" value={name} disabled readOnly hint="Ask your counsellor to change your name" />
          <TextField label="Email" value={email} disabled readOnly hint="Your login email" />
          <TextField label="Mobile number" required type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98XXXXXXXX" hint="10-digit Indian mobile" error={errors.mobile?.message} {...register('mobile')} />
          <TextField label="Date of birth" type="date" required error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
          <SelectField label="Gender (optional)" placeholder="Choose" options={genders} error={errors.gender?.message} {...register('gender')} />
        </div>
      </Panel>

      <Panel id="edit-address" title="Permanent address" icon={<MapPin className="h-4 w-4" aria-hidden />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Address line 1" required autoComplete="address-line1" placeholder="House or flat number, building, street" error={errors.addressLine1?.message} {...register('addressLine1')} />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Address line 2 (optional)" autoComplete="address-line2" placeholder="Area, landmark" error={errors.addressLine2?.message} {...register('addressLine2')} />
          </div>
          <SelectField label="State" required placeholder="Choose your state" options={states} autoComplete="address-level1" error={errors.state?.message} {...register('state')} />
          <ComboField
            label="City or town"
            required
            placeholder={state ? 'Choose or type your city' : 'Choose your state first, or type'}
            options={state ? (CITIES_BY_STATE[state] ?? []) : ALL_CITIES}
            hint="Pick from the list or type your own"
            error={errors.city?.message}
            {...register('city')}
          />
          <TextField label="PIN code" required inputMode="numeric" maxLength={6} autoComplete="postal-code" placeholder="6 digits" error={errors.pincode?.message} {...register('pincode')} />
        </div>
      </Panel>

      <Panel id="edit-study" title="Study plans" icon={<BookOpen className="h-4 w-4" aria-hidden />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2" data-course-list>
            <legend className="mb-1.5 block text-sm font-medium text-navy-800">
              Courses of interest
              <span className="ml-0.5 text-red-600" aria-hidden>
                *
              </span>
            </legend>
            <p className="mb-3 text-xs text-navy-400">Add up to {MAX_COURSES}, your first choice first. Pick from the list or type your own.</p>
            <ol className="space-y-2.5">
              {courses.fields.map((f, i) => {
                const error = errors.courseInterests?.[i]?.value?.message;
                return (
                  <li key={f.id}>
                    <div className="flex items-center gap-2">
                      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', i === 0 ? 'bg-gold-500 text-navy-950' : 'bg-navy-50 text-navy-600')} aria-hidden>
                        {i + 1}
                      </span>
                      <input
                        className={cn('input', error && 'input-error')}
                        list="course-suggestions"
                        autoComplete="off"
                        placeholder={i === 0 ? 'Choose or type, e.g. Data Science & Analytics' : 'e.g. Business Analytics'}
                        aria-label={`Course ${i + 1}`}
                        aria-invalid={!!error}
                        {...register(`courseInterests.${i}.value`)}
                      />
                      {courses.fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => courses.remove(i)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove course ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {error && (
                      <p role="alert" className="ml-10 mt-1.5 text-xs font-medium text-red-600">
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <datalist id="course-suggestions">
              {courseSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {(errors.courseInterests?.message || errors.courseInterests?.root?.message) && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                {errors.courseInterests?.message ?? errors.courseInterests?.root?.message}
              </p>
            )}
            {courses.fields.length < MAX_COURSES && (
              <button
                type="button"
                onClick={() => courses.append({ value: '' })}
                className="ml-10 mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50"
                data-add-course
              >
                <Plus className="h-4 w-4" aria-hidden /> Add another course
              </button>
            )}
          </fieldset>
          <SelectField label="Preferred destination" required placeholder="Choose a destination" options={destinations} error={errors.destination?.message} {...register('destination')} />
          <SelectField label="Preferred intake" required placeholder="Choose an intake" options={intakes} error={errors.intake?.message} {...register('intake')} />
          <SelectField label="Budget (total)" required placeholder="Choose a budget" options={budgets} error={errors.budget?.message} {...register('budget')} />
        </div>
      </Panel>

      <Panel id="edit-education" title="Education and tests" icon={<GraduationCap className="h-4 w-4" aria-hidden />}>
        <FormGroup title="Highest qualification">
          <SelectField label="Highest qualification" required placeholder="Choose your highest qualification" options={qualifications} error={errors.degree?.message} {...register('degree')} />
          {schoolHighest ? (
            hscFields(true)
          ) : (
            degree && (
              <>
                {otherDegree ? (
                  <TextField label="Name of your qualification" required placeholder="e.g. Advanced Diploma in Animation" error={errors.degreeSubject?.message} {...register('degreeSubject')} />
                ) : (
                  <ComboField label="Specialisation (optional)" placeholder="e.g. Computer Science" options={SPECIALISATIONS} error={errors.degreeSubject?.message} {...register('degreeSubject')} />
                )}
                <div className="sm:col-span-2">
                  <ComboField
                    label="College or university"
                    required
                    placeholder="Choose or type your college or university"
                    options={INDIAN_INSTITUTIONS}
                    hint="Pick from the list or type your own"
                    error={errors.institution?.message}
                    {...register('institution')}
                  />
                </div>
                <SelectField label="Year of passing (or expected)" required placeholder="Choose year" options={degreeYears} error={errors.graduationYear?.message} {...register('graduationYear')} />
                <TextField label="Percentage or CGPA (optional)" placeholder="e.g. 8.4 CGPA or 72%" error={errors.grade?.message} {...register('grade')} />
              </>
            )
          )}
        </FormGroup>

        <fieldset className="mb-6 border-b border-navy-100 pb-6" data-other-qualifications>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">
            Other qualifications<span className="ml-1.5 font-medium normal-case tracking-normal text-navy-300">(optional)</span>
          </legend>
          <div className="space-y-3">
            {added.hsc && !schoolHighest && (
              <QualificationCard title="12th (HSC) or diploma" onRemove={() => removeQualification('hsc')}>
                {hscFields(false)}
              </QualificationCard>
            )}
            {added.ssc && (
              <QualificationCard title="10th (SSC)" onRemove={() => removeQualification('ssc')}>
                <SelectField label="Board" placeholder="Choose your board" options={sscBoards} error={errors.sscBoard?.message} {...register('sscBoard')} />
                <TextField label="School" placeholder="School name and town" error={errors.sscSchool?.message} {...register('sscSchool')} />
                <SelectField label="Year of passing" placeholder="Choose year" options={schoolYears} error={errors.sscYear?.message} {...register('sscYear')} />
                <TextField label="Percentage or CGPA" placeholder="e.g. 88% or 9.2 CGPA" error={errors.sscScore?.message} {...register('sscScore')} />
              </QualificationCard>
            )}
            {addable.length > 0 &&
              (choosing ? (
                <div className="flex flex-wrap items-center gap-2" data-qualification-choices>
                  {addable.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => {
                        setAdded((a) => ({ ...a, [q.key]: true }));
                        setChoosing(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50"
                      data-add-choice={q.key}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> {q.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setChoosing(false)} className="px-2 py-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setChoosing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-navy-200 transition hover:bg-navy-50"
                  data-add-qualification
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add qualification
                </button>
              ))}
          </div>
        </fieldset>

        <FormGroup title="English test and experience" last>
          <TextField label="Work experience (optional)" placeholder="e.g. 2 years · Data Analyst" error={errors.workExperience?.message} {...register('workExperience')} />
          <div className="hidden sm:block" aria-hidden />
          <SelectField label="English test" required options={englishTests} error={errors.englishTest?.message} {...register('englishTest')} />
          <TextField
            label="English score"
            required={test !== 'Not taken yet'}
            inputMode="decimal"
            placeholder={test === 'Not taken yet' ? 'Not needed yet' : 'Overall score'}
            readOnly={test === 'Not taken yet'}
            error={errors.englishScore?.message}
            {...register('englishScore')}
          />
        </FormGroup>
      </Panel>

      <div className="sticky bottom-16 z-10 -mx-1 flex justify-end gap-3 bg-[#F4F1EA]/95 px-1 py-4 backdrop-blur sm:bottom-0">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {completing ? 'Later' : 'Cancel'}
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!completing && !isDirty}>
          {completing ? 'Save profile' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
