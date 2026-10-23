import { useState } from 'react';
import { CheckCircle2, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import type { User } from '../../lib/api/types';
import type { StudentProfile } from '../../data/dashboard';
import type { Counsellor } from '../../data/staff';
import { formatDate, initials } from '../../lib/utils';
import { Panel } from './Panel';
import { EditProfileModal } from './EditProfileModal';

interface Props {
  user: User;
  profile: StudentProfile;
  onSave: (profile: StudentProfile) => void;
  passportLocked: boolean;
  counsellor: Counsellor;
}

export function ProfileCard({ user, profile, onSave, passportLocked, counsellor }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const rows = [
    { label: 'Course', value: profile.courseInterest },
    { label: 'Destination', value: profile.destination },
    { label: 'Intake', value: profile.intake },
    { label: 'Education', value: `${profile.degree} · ${profile.grade}` },
    {
      label: 'English test',
      value: profile.englishTest === 'Not taken yet' ? 'Not taken yet' : `${profile.englishTest} ${profile.englishScore}`,
    },
    { label: 'Experience', value: profile.workExperience || '—' },
    { label: 'Budget', value: profile.budget },
    { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
    { label: 'City', value: profile.city },
  ];

  return (
    <Panel
      id="profile"
      title="My profile"
      icon={<UserRound className="h-4 w-4" aria-hidden />}
      action={
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-800 transition hover:border-navy-900 hover:bg-navy-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </button>
      }
    >
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 font-display text-2xl text-gold-400">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-navy-900">{user.name}</p>
          <p className="truncate text-sm text-navy-500">{user.email}</p>
          {user.studentReference && <p className="mt-1 text-xs font-medium text-navy-400">Ref. {user.studentReference}</p>}
        </div>
      </div>

      {saved && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Profile updated
        </p>
      )}

      <dl className="mt-5 grid gap-3 rounded-2xl bg-ivory p-4 text-sm">
        {rows.map((d) => (
          <div key={d.label} className="flex justify-between gap-4">
            <dt className="shrink-0 text-navy-500">{d.label}</dt>
            <dd className="text-right font-medium text-navy-900">{d.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-t border-navy-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Your counsellor</p>
        <p className="mt-2 font-semibold text-navy-900">{counsellor.name}</p>
        <p className="text-sm text-navy-500">Your named counsellor</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`mailto:${counsellor.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-100">
            <Mail className="h-3.5 w-3.5" aria-hidden /> Email
          </a>
          <a href={`tel:${counsellor.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-navy-100">
            <Phone className="h-3.5 w-3.5" aria-hidden /> Call
          </a>
        </div>
      </div>

      <EditProfileModal
        open={editing}
        onClose={() => setEditing(false)}
        profile={profile}
        name={user.name}
        email={user.email}
        passportLocked={passportLocked}
        onSave={(p) => {
          onSave(p);
          setSaved(true);
        }}
      />
    </Panel>
  );
}
