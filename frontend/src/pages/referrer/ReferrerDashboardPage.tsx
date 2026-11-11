import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Gift, PartyPopper, Send, Share2, UserRoundCheck, X } from 'lucide-react';
import { Container } from '../../components/ui/Container';
import { ReferralsPanel } from '../../components/referrals/ReferralsPanel';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  { icon: Share2, title: 'Share your link', text: 'Send your personal link to anyone thinking of studying abroad, or invite them by email.' },
  { icon: UserRoundCheck, title: 'They register free', text: 'When they create an account through your link or invitation, they appear in your list.' },
  { icon: Send, title: 'Follow their progress', text: 'See when they complete their profile, apply, and accept an offer.' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** A referrer's dashboard: their referral link, invitations by email, and how far each person they referred has got. */
export function ReferrerDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(!!(location.state as { welcome?: boolean } | null)?.welcome);
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <div className="bg-[#F4F1EA] pb-20 pt-24 xl:pt-[73px]">
      <div className="bg-navy-950 py-8 sm:py-12">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Referrer dashboard</p>
          <h1 className="mt-2 text-2xl text-white sm:text-4xl">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-200 sm:text-base">
            Refer friends, family and colleagues who want to study abroad. AHat's guidance is free for them, and you can follow how far they get.
          </p>
        </Container>
      </div>

      <Container className="mt-6 space-y-6 sm:mt-8">
        {showWelcome && (
          <div role="status" className="flex animate-fade-up items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
            <PartyPopper className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div className="flex-1 text-sm text-emerald-900">
              <p className="font-semibold">Welcome to AHat, {firstName}!</p>
              <p className="mt-1">Your referrer account is ready. Share your link below to start referring.</p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* How it works */}
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-400">
                <s.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  <span className="text-gold-600">{i + 1}.</span> {s.title}
                </p>
                <p className="mt-1 text-sm text-navy-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <ReferralsPanel shareMessage="AHat gives free, honest guidance for studying abroad, from choosing a course to settling in. Create your free account here:" />

        {/* Rewards: none yet. Kept vague on purpose until AHat decides what they will be. */}
        <div className="flex items-start gap-4 rounded-2xl border border-gold-200 bg-gold-50 p-5" data-rewards>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500 text-navy-950">
            <Gift className="h-5 w-5" aria-hidden />
          </span>
          <div className="text-sm text-navy-800">
            <p className="font-semibold text-navy-900">Rewards for referrers are coming</p>
            <p className="mt-1">
              We're working on ways to thank our referrers. There are no rewards yet, but everyone you refer is recorded here, and any future rewards will be
              announced on this page.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
