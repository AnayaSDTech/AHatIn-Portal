import { ArrowUpRight, CalendarDays, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { SmartImage } from '../ui/SmartImage';
import { destinations } from '../../data/site';

export function Destinations() {
  return (
    <section id="destinations" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Study destinations"
          title={<>Where will your degree <span className="italic text-gold-600">take you?</span></>}
          description="We specialise in the UK and Europe, two of the world's strongest study destinations, so our advice is deep, current and practical."
        />

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-2">
          {destinations.map((d, i) => (
            <Reveal key={d.name} delay={i * 120}>
              <article className="group relative h-full overflow-hidden rounded-3xl bg-white shadow-soft transition-all duration-500 hover:-translate-y-2 hover:shadow-lift">
                <div className="relative h-60 overflow-hidden">
                  <SmartImage
                    src={d.image}
                    alt={`${d.name} city view`}
                    className="h-full w-full transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/10 to-transparent" aria-hidden />
                  <h3 className="absolute bottom-5 left-6 text-2xl font-semibold text-white">{d.name}</h3>
                </div>
                <div className="p-6">
                  <p className="text-navy-600">{d.tagline}</p>
                  <ul className="mt-5 space-y-2.5">
                    {d.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2.5 text-sm text-navy-800">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-center justify-between border-t border-navy-100 pt-5">
                    <span className="flex items-center gap-2 text-xs font-medium text-navy-500">
                      <CalendarDays className="h-4 w-4" aria-hidden /> {d.intakes}
                    </span>
                    <Link
                      to={`/?destination=${d.name === 'United Kingdom' ? 'uk' : 'europe'}#enquire`}
                      className="flex items-center gap-1 text-sm font-semibold text-navy-900 transition hover:text-gold-700"
                      aria-label={`Get guidance for ${d.name}`}
                    >
                      Get guidance <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
