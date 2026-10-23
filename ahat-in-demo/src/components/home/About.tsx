import { BadgeCheck, Quote } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Reveal } from '../ui/Reveal';
import { SmartImage } from '../ui/SmartImage';
import { aboutPoints, images } from '../../data/site';

export function About() {
  return (
    <section id="about" className="scroll-mt-24 py-24 sm:py-32">
      <Container className="grid items-center gap-16 lg:grid-cols-2">
        <Reveal className="relative">
          <SmartImage
            src={images.about}
            alt="Students studying together"
            className="aspect-[4/5] w-full rounded-[2rem] shadow-lift sm:aspect-[5/4] lg:aspect-[4/5]"
          />
          <div className="absolute -bottom-8 -right-4 max-w-xs rounded-2xl bg-white p-6 shadow-lift sm:-right-8">
            <Quote className="h-6 w-6 text-gold-500" aria-hidden />
            <p className="mt-3 font-display text-lg leading-snug text-navy-900">
              “We measure success by where our students end up, not by how many we sign up.”
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-navy-400">AHatIn founding principle</p>
          </div>
          <div className="absolute -left-6 -top-6 -z-10 h-40 w-40 rounded-3xl bg-gold-200/60" aria-hidden />
        </Reveal>

        <div>
          <SectionHeading
            align="left"
            eyebrow="About AHatIn"
            title={<>Advice you can trust, <span className="italic text-gold-600">people who care</span></>}
            description="AHatIn International Educational Consultancy helps Indian students make one of the biggest decisions of their lives with clarity and confidence. We combine experienced counsellors with a modern student portal, so nothing falls through the cracks."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {aboutPoints.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="flex gap-4">
                  <BadgeCheck className="mt-1 h-6 w-6 shrink-0 text-gold-600" aria-hidden />
                  <div>
                    <h3 className="font-sans text-base font-semibold text-navy-900">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{p.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
