import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '../ui/Container';
import { Logo } from '../ui/Logo';
import { DemoBadge } from '../ui/DemoBadge';
import { contact, destinations, navLinks, services } from '../../data/site';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-navy-200">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
      <Container className="relative grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-navy-300">
            Free, honest guidance for Indian students heading to the UK and Europe, from career counselling to
            settling in abroad.
          </p>
          <DemoBadge light className="mt-6" label="Demo website" />
        </div>

        <div className="lg:col-span-2">
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Explore</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link to={`/${l.href}`} className="transition hover:text-gold-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Services</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {services.slice(0, 5).map((s) => (
              <li key={s.code}>
                <Link to="/#services" className="transition hover:text-gold-300">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mt-8 font-sans text-sm font-semibold uppercase tracking-wider text-white">Destinations</h3>
          <p className="mt-3 text-sm">{destinations.map((d) => d.name).join(' · ')}</p>
        </div>

        <div className="lg:col-span-3">
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Contact (demo)</h3>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
              <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-gold-300">{contact.phone}</a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
              <a href={`mailto:${contact.email}`} className="hover:text-gold-300">{contact.email}</a>
            </li>
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
              <span>{contact.address}</span>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
              <span>{contact.hours}</span>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-navy-400 sm:flex-row">
          <p>© {year} AHat International Educational Consultancy. Demo build: names, figures and contact details are fictional.</p>
          <p className="flex gap-5">
            <a href="#" className="hover:text-gold-300">Privacy notice</a>
            <a href="#" className="hover:text-gold-300">Terms of use</a>
          </p>
        </Container>
      </div>
    </footer>
  );
}
