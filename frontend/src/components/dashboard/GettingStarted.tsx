import { CalendarDays, CheckCircle2, Circle, Clock, Rocket } from 'lucide-react';
import type { Counsellor } from '../../data/staff';
import type { StudentProfile } from '../../data/dashboard';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

interface Props {
  profile: StudentProfile;
  profileComplete: boolean;
  counsellor: Counsellor | null;
  onCompleteProfile: () => void;
  onBook: () => void;
}

type StepState = 'done' | 'current' | 'waiting' | 'later';

/**
 * Shown instead of the progress tracker until the journey can start: the student completes their profile, then
 * the admin assigns a counsellor based on it, then the first career counselling session is booked.
 */
export function GettingStarted({ profile, profileComplete, counsellor, onCompleteProfile, onBook }: Props) {
  const country = profile.destination && profile.destination !== 'Not sure yet' ? profile.destination : 'your chosen country';
  const steps: { title: string; text: string; state: StepState; action?: { label: string; onClick: () => void; icon?: typeof CalendarDays } }[] = [
    {
      title: 'Complete your profile',
      text: profileComplete
        ? 'Done. You can update it any time from My profile.'
        : 'Your education, English test and study plans. It takes about five minutes.',
      state: profileComplete ? 'done' : 'current',
      action: profileComplete ? undefined : { label: 'Complete profile', onClick: onCompleteProfile },
    },
    {
      title: 'Meet your counsellor',
      text: counsellor
        ? `${counsellor.name} is your counsellor.`
        : profileComplete
          ? `We're matching you with a counsellor who knows ${country}. We'll email you when they're assigned.`
          : 'We match you with a counsellor who knows your chosen country and course, based on your profile.',
      state: counsellor ? 'done' : profileComplete ? 'waiting' : 'later',
    },
    {
      title: 'Book your first career counselling session',
      text: 'Your counsellor shares your career plan after it, and your seven services start from there.',
      state: profileComplete && counsellor ? 'current' : 'later',
      action: profileComplete && counsellor ? { label: 'Book a session', onClick: onBook, icon: CalendarDays } : undefined,
    },
  ];

  return (
    <section id="progress" className="card p-6" aria-labelledby="getting-started-title" data-getting-started>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-50 text-gold-700">
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 id="getting-started-title" className="font-sans text-lg font-semibold text-navy-900">Getting started</h2>
          <p className="text-sm text-navy-500">Your progress tracker opens once these steps are done.</p>
        </div>
      </div>

      <ol className="mt-6 space-y-5">
        {steps.map((step, i) => {
          const Icon = step.state === 'done' ? CheckCircle2 : step.state === 'waiting' ? Clock : Circle;
          return (
            <li key={step.title} className="flex gap-4" data-step-state={step.state}>
              <Icon
                className={cn(
                  'mt-0.5 h-6 w-6 shrink-0',
                  step.state === 'done' ? 'text-emerald-600' : step.state === 'current' ? 'text-gold-600' : step.state === 'waiting' ? 'text-sky-600' : 'text-navy-200',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold', step.state === 'later' ? 'text-navy-400' : 'text-navy-900')}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </p>
                <p className={cn('mt-0.5 text-sm', step.state === 'later' ? 'text-navy-400' : 'text-navy-600')}>{step.text}</p>
                {step.action && (
                  <Button size="sm" className="mt-3" onClick={step.action.onClick}>
                    {step.action.icon && <step.action.icon className="h-4 w-4" aria-hidden />} {step.action.label}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
