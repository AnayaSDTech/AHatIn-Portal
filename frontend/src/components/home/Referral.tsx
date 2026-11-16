import { ArrowRight, Gift } from 'lucide-react';
import { Container } from '../ui/Container';
import { ButtonLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';

/** A short invitation to the referral programme, linking to the page that explains it. */
export function Referral() {
  return (
    <section id="refer" className="py-16" data-home-referral>
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 px-6 py-10 text-white sm:px-12">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/30">
                  <Gift className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">Referral programme</p>
                  <h2 className="mt-2 text-2xl leading-snug text-white sm:text-3xl">Know someone who dreams of studying abroad?</h2>
                  <p className="mt-2 max-w-xl text-navy-100">Refer friends and family to our free guidance, and follow their journey from your own dashboard.</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <ButtonLink to="/refer" variant="gold">
                  How referrals work
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </ButtonLink>
                <ButtonLink to="/referrer/register" variant="light">
                  Become a referrer
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
