import { Hero } from '../components/home/Hero';
import { Destinations } from '../components/home/Destinations';
import { Services } from '../components/home/Services';
import { About } from '../components/home/About';
import { Universities } from '../components/home/Universities';
import { Testimonials } from '../components/home/Testimonials';
import { Faq } from '../components/home/Faq';
import { Enquiry } from '../components/home/Enquiry';
import { CallToAction } from '../components/home/CallToAction';

export function HomePage() {
  return (
    <>
      <Hero />
      <Destinations />
      <Services />
      <About />
      <Universities />
      <Testimonials />
      <Faq />
      <Enquiry />
      <CallToAction />
    </>
  );
}
