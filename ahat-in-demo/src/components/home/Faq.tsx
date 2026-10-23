import { MessageCircle } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Accordion } from '../ui/Accordion';
import { Reveal } from '../ui/Reveal';
import { ButtonLink } from '../ui/Button';
import { faqs } from '../../data/site';

export function Faq() {
  return (
    <section id="faqs" className="scroll-mt-24 bg-white py-24 sm:py-32">
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading
            align="left"
            eyebrow="FAQs"
            title="Questions students and parents ask"
            description="Can't find your answer? Send us your question and a counsellor will call you back."
          />
          <Reveal className="mt-8">
            <ButtonLink to="/#enquire" variant="primary">
              <MessageCircle className="h-4 w-4" aria-hidden /> Talk to a counsellor
            </ButtonLink>
          </Reveal>
        </div>
        <Reveal className="lg:col-span-8">
          <Accordion items={faqs} />
        </Reveal>
      </Container>
    </section>
  );
}
