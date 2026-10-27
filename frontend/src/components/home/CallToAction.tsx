import { ArrowRight } from 'lucide-react';
import { Container } from '../ui/Container';
import { ButtonLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';

export function CallToAction() {
  return (
    <section className="py-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 px-8 py-14 text-center shadow-lift sm:px-16">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-2xl" aria-hidden />
            <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-navy-900/20 blur-2xl" aria-hidden />
            <h2 className="relative mx-auto max-w-2xl text-3xl text-navy-950 sm:text-4xl">
              Ready to plan your study-abroad journey?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-navy-900/80">
              Register in under a minute. Your counsellor will contact you, and your portal will be ready straight away.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/register" variant="primary" size="lg">
                Register for free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/login" variant="outline" size="lg" className="border-navy-900/20 bg-white/40">
                I already have an account
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
