import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Pencil, Phone } from 'lucide-react';
import type { User } from '../../lib/api/types';
import type { StudentProfile } from '../../data/dashboard';
import type { Counsellor } from '../../data/staff';
import { formatDate, initials } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EditProfileModal } from './EditProfileModal';

interface Props {
  open: boolean;
  onClose: () => void;
  user: User;
  profile: StudentProfile;
  onSave: (profile: StudentProfile) => Promise<void>;
  passportLocked: boolean;
  /** Null until the admin assigns one. */
  counsellor: Counsellor | null;
  /** Open straight on the edit form (e.g. at sign-in while the profile is incomplete); closing it closes everything. */
  startEditing?: boolean;
  /** The profile isn't complete yet: the form asks the student to complete it. */
  completing?: boolean;
}

/** "My profile", opened from the account menu (or a notification). Editing opens the edit form in its place. */
export function ProfileModal({ open, onClose, user, profile, onSave, passportLocked, counsellor, startEditing = false, completing = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  // Opened straight on the form: cancelling closes the window instead of going back to the profile.
  const [direct, setDirect] = useState(false);
  useEffect(() => {
    if (open && startEditing) {
      setEditing(true);
      setDirect(true);
    }
    if (!open) {
      setEditing(false);
      setDirect(false);
    }
  }, [open, startEditing]);

  const rows = [
    { label: 'Course', value: profile.courseInterest },
    { label: 'Destination', value: profile.destination },
    { label: 'Intake', value: profile.intake },
    { label: 'Education', value: [profile.degree, profile.grade].filter(Boolean).join(' · ') },
    {
      label: 'English test',
      value: profile.englishTest === 'Not taken yet' ? 'Not taken yet' : `${profile.englishTest} ${profile.englishScore}`,
    },
    { label: 'Experience', value: profile.workExperience },
    { label: 'Budget', value: profile.budget },
    { label: 'Date of birth', value: profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '' },
    { label: 'City', value: profile.city },
  ].map((r) => ({ ...r, value: r.value || '—' }));

  const close = () => {
    setSaved(false);
    onClose();
  };

  return (
    <>
      <Modal
        open={open && !editing}
        onClose={close}
        title="My profile"
        footer={
          <>
            <Button variant="outline" onClick={close}>Close</Button>
            <Button
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden /> Edit profile
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 font-display text-xl text-gold-400">{initials(user.name)}</span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-navy-900">{user.name}</p>
            <p className="truncate text-sm text-navy-500">{user.email}</p>
            {user.studentReference && <p className="text-xs font-medium text-navy-400">Ref. {user.studentReference}</p>}
          </div>
        </div>

        {saved && (
          <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Profile updated
          </p>
        )}

        <dl id="profile-details" className="mt-5 grid gap-2.5 rounded-2xl bg-ivory p-4 text-sm">
          {rows.map((d) => (
            <div key={d.label} className="flex justify-between gap-4">
              <dt className="shrink-0 text-navy-500">{d.label}</dt>
              <dd className="text-right font-medium text-navy-900">{d.value}</dd>
            </div>
          ))}
        </dl>

        {counsellor ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Your counsellor</p>
            <p className="font-semibold text-navy-900">{counsellor.name}</p>
          </div>
          <div className="flex gap-2">
            <a href={`mailto:${counsellor.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-100">
              <Mail className="h-3.5 w-3.5" aria-hidden /> Email
            </a>
            <a href={`tel:${counsellor.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-100">
              <Phone className="h-3.5 w-3.5" aria-hidden /> Call
            </a>
          </div>
        </div>
        ) : (
          <p className="mt-5 border-t border-navy-100 pt-4 text-sm text-navy-500">
            {completing ? 'Complete your profile and we will match you with a counsellor.' : "We're matching you with a counsellor and will email you when they're assigned."}
          </p>
        )}
      </Modal>

      <EditProfileModal
        open={open && editing}
        onClose={() => (direct ? close() : setEditing(false))}
        completing={completing}
        profile={profile}
        name={user.name}
        email={user.email}
        passportLocked={passportLocked}
        onSave={async (p) => {
          await onSave(p);
          setSaved(true);
          setEditing(false);
          setDirect(false);
        }}
      />
    </>
  );
}
