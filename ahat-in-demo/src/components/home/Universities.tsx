import { Building2, MapPin } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { DemoBadge } from '../ui/DemoBadge';
import { SmartImage } from '../ui/SmartImage';
import { images, qsEdition, universities } from '../../data/site';

export function Universities() {
  return (
    <section id="universities" className="relative scroll-mt-24 overflow-hidden bg-white py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Top-ranked universities"
          title={<>The UK and Europe's <span className="italic text-gold-600">leading universities</span></>}
          description={`Ranked in the ${qsEdition}. Your shortlist is always built around your profile, budget and goals.`}
        />
        <div className="mt-4 flex justify-center">
          <DemoBadge label="Illustrative list · not a partnership claim" />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {universities.map((u, i) => (
            <Reveal key={u.name} delay={(i % 4) * 80}>
              <div className="group h-full rounded-2xl border border-navy-100 bg-ivory/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold-300 hover:bg-white hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 text-gold-400 transition group-hover:bg-gold-500 group-hover:text-navy-950">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-right" title={`${qsEdition}: ${u.qsRank.startsWith('=') ? `joint ${u.qsRank.slice(1)}` : u.qsRank}`}>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-navy-400">{u.qsRank.startsWith('=') ? 'QS rank · joint' : 'QS rank'}</span>
                    <span className="font-display text-2xl leading-none text-navy-900">#{u.qsRank.replace('=', '')}</span>
                  </span>
                </div>
                <h3 className="mt-5 font-sans text-base font-semibold leading-snug text-navy-900">{u.name}</h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {u.city}, {u.country}
                </p>
                <p className="mt-4 text-sm text-navy-600">{u.programmes}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-navy-400">
          Source: {qsEdition}, published June 2026. “Joint” means the rank is shared with another university. Ranks change every year.
        </p>

        <Reveal className="mt-16">
          <div className="relative overflow-hidden rounded-3xl">
            <SmartImage src={images.campus} alt="University campus" className="h-64 w-full sm:h-80" />
            <div className="absolute inset-0 flex items-center bg-gradient-to-r from-navy-950/90 via-navy-950/60 to-transparent">
              <div className="max-w-lg px-8 sm:px-12">
                <p className="font-display text-2xl text-white sm:text-3xl">150+ universities reachable through our partner agencies</p>
                <p className="mt-3 text-sm text-navy-100">Demo figure. We apply through trusted partner agencies across the UK and Europe.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
