import { Compass } from 'lucide-react';
import { Container } from '../components/ui/Container';
import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <section className="grid min-h-[80vh] place-items-center pt-24">
      <Container className="max-w-lg text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-navy-900 text-gold-400">
          <Compass className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-6 text-4xl">Page not found</h1>
        <p className="mt-3 text-navy-600">The page you're looking for doesn't exist or has moved.</p>
        <ButtonLink to="/" className="mt-8">
          Back to home
        </ButtonLink>
      </Container>
    </section>
  );
}
