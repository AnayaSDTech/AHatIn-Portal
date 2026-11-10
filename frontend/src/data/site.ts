import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  GraduationCap,
  FileText,
  Coins,
  Stamp,
  Luggage,
  HeartHandshake,
  MapPinned,
  Briefcase,
} from 'lucide-react';

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const images = {
  hero: img('photo-1627556704290-2b1f5853ff78', 1600),
  about: img('photo-1522202176988-66273c2fd55f', 1200),
  campus: img('photo-1541339907198-e08756dedf3f', 1400),
};

export const navLinks = [
  { label: 'Destinations', href: '#destinations' },
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'Universities', href: '#universities' },
  { label: 'Scholarships', href: '#scholarships' },
  { label: 'Stories', href: '#stories' },
  { label: 'FAQs', href: '#faqs' },
  { label: 'Enquire', href: '#enquire' },
];

/** DEMO figures, shown with a "demo content" label on the page. */
export const stats = [
  { value: '1,200+', label: 'Students guided' },
  { value: '95%', label: 'Visa success rate' },
  { value: '150+', label: 'Universities reached' },
  { value: '₹0', label: 'Consultancy fee' },
];

export interface Destination {
  name: string;
  tagline: string;
  image: string;
  highlights: string[];
  intakes: string;
}

export const destinations: Destination[] = [
  {
    name: 'United Kingdom',
    tagline: 'World-famous universities. One-year master’s.',
    image: img('photo-1513635269975-59663e0ac1ad', 900),
    highlights: ['1-year master’s degrees', 'Graduate Route work visa', 'Scholarships for Indians'],
    intakes: 'September · January',
  },
  {
    name: 'Europe',
    tagline: 'Top quality. Lower costs.',
    image: img('photo-1502602898657-3e91760cbb34', 900),
    highlights: ['Low or no fees in Germany', 'Taught in English', 'Work after study in Ireland'],
    intakes: 'Winter · Summer · September',
  },
];

export interface Service {
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const services: Service[] = [
  {
    code: 'S1',
    title: 'Career Counselling & Course Selection',
    description: 'Find the course that fits your goals.',
    icon: Compass,
  },
  {
    code: 'S2',
    title: 'University & Country Selection',
    description: 'The right country and university for your budget.',
    icon: GraduationCap,
  },
  {
    code: 'S3',
    title: 'Application Assistance',
    description: 'SOP, LOR, CV and applications, done right.',
    icon: FileText,
  },
  {
    code: 'S4',
    title: 'Scholarship & Financial Guidance',
    description: 'Scholarships, cost estimates and a funding plan.',
    icon: Coins,
  },
  {
    code: 'S5',
    title: 'Visa Assistance',
    description: 'Checklists, document checks and mock interviews.',
    icon: Stamp,
  },
  {
    code: 'S6',
    title: 'Pre-Departure Support',
    description: 'Housing, flights, forex and insurance, sorted.',
    icon: Luggage,
  },
  {
    code: 'S7',
    title: 'Post-Arrival Support',
    description: 'A safe-arrival check and support in your first months.',
    icon: HeartHandshake,
  },
  {
    code: 'S8',
    title: 'On-site Support',
    description: 'A local contact whenever you need a hand.',
    icon: MapPinned,
  },
  {
    code: 'S9',
    title: 'Job Assistance',
    description: 'Part-time jobs, local CVs and post-study work.',
    icon: Briefcase,
  },
];

export const aboutPoints = [
  { title: 'Free for students', text: 'No fees, from day one to settling in.' },
  { title: 'Your own counsellor', text: 'One expert with you at every step.' },
  { title: 'Honest advice', text: 'We tell you which universities pay us commission.' },
  { title: 'Track everything', text: 'Applications, documents and deadlines in one portal.' },
];

/** Edition the ranks below come from. Update the list and this label together once a year. */
export const qsEdition = 'QS World University Rankings 2027';

/**
 * Top UK and European universities, in QS World University Rankings 2027 order (published 18 June 2026).
 * "=" marks a joint rank. Shown for illustration only; not a claim of partnership.
 */
export const universities = [
  { name: 'Imperial College London', country: 'United Kingdom', city: 'London', qsRank: '=2', programmes: 'Engineering, Medicine, Business' },
  { name: 'University of Oxford', country: 'United Kingdom', city: 'Oxford', qsRank: '4', programmes: 'Humanities, Sciences, Business' },
  { name: 'University of Cambridge', country: 'United Kingdom', city: 'Cambridge', qsRank: '6', programmes: 'Sciences, Engineering, Economics' },
  { name: 'ETH Zurich', country: 'Switzerland', city: 'Zurich', qsRank: '=8', programmes: 'Engineering, Computer Science, Architecture' },
  { name: 'University College London (UCL)', country: 'United Kingdom', city: 'London', qsRank: '=8', programmes: 'Architecture, Education, Life Sciences' },
  { name: 'EPFL', country: 'Switzerland', city: 'Lausanne', qsRank: '=22', programmes: 'Engineering, Computer Science' },
  { name: 'Technical University of Munich', country: 'Germany', city: 'Munich', qsRank: '25', programmes: 'Engineering, Informatics, Management' },
  { name: 'Université PSL', country: 'France', city: 'Paris', qsRank: '34', programmes: 'Sciences, Economics, Arts' },
];

/** DEMO: fictional student stories. */
/** Real students' stories, as published on the AHatIn website. Photos are in public/images/testimonials. */
export const testimonials: { name: string; university: string; course?: string; image: string; quote: string }[] = [
  {
    name: 'Nilesh Sonole',
    university: 'University of Nottingham',
    image: '/images/testimonials/nilesh-sonole.jpg',
    quote:
      'The guidance I received made the admission process so smooth. I was confused about choosing the right university, but their support helped me secure a place in the UK with complete clarity.',
  },
  {
    name: 'Karan Patil',
    university: 'University of Manchester',
    course: 'MSc Pollution and Environmental Control',
    image: '/images/testimonials/karan-patil.jpg',
    quote:
      'From shortlisting universities to preparing documents, the team was always available. I’m now pursuing my MSc in Pollution and Environmental Control in the UK, and I couldn’t have done it without their help.',
  },
  {
    name: 'Sadichcha',
    university: 'University of Leeds',
    image: '/images/testimonials/sadichcha.jpg',
    quote:
      'The team made my study abroad journey simple and transparent. From selecting universities to getting my visa approved, their constant support made a huge difference.',
  },
  {
    name: 'Nirdesh Sagathia',
    university: 'The University of York',
    image: '/images/testimonials/nirdesh-sagathia.jpg',
    quote:
      'The best part was the personal attention. They understood my career goals and guided me towards the right universities in UK. I felt supported throughout.',
  },
  {
    name: 'Nirmiti Pakhale',
    university: 'University of Manchester',
    image: '/images/testimonials/nirmiti-mahendra-pakhale.jpg',
    quote:
      'I had no idea how to start my application, but their team made the process stress-free. With their guidance, I successfully completed my Master’s in the UK and achieved my dream of studying abroad.',
  },
  {
    name: 'Bhushan Saharkar',
    university: 'University of Exeter',
    image: '/images/testimonials/bhushan-saharkar.jpg',
    quote:
      'From SOP writing to visa preparation, every step was explained clearly. I received multiple admission offers and finally chose my dream university in the UK.',
  },
  {
    name: 'Siddhant Ramteke',
    university: 'University of Manchester',
    image: '/images/testimonials/siddhant-ramteke.jpg',
    quote:
      'I always dreamed of studying abroad but didn’t know where to begin. With their support, I secured admission in the UK. The entire process was smooth and stress-free.',
  },
  {
    name: 'Raju Sarkar',
    university: 'The University of Manchester',
    course: 'MSc Global Development (Poverty and Inequality)',
    image: '/images/testimonials/raju-sarkar.jpg',
    quote:
      'I was worried about financing my studies abroad, but their advice on scholarships and planning gave me confidence. With their support, I successfully completed my MSc in Global Development (Poverty and Inequality) in the UK.',
  },
];

export const faqs = [
  {
    q: 'Is AHat’s guidance really free?',
    a: 'Yes. Universities and partner agencies pay us when you enrol, and we always tell you which ones.',
  },
  {
    q: 'Which countries do you help with?',
    a: 'The UK and Europe, mainly Germany, Ireland and France.',
  },
  {
    q: 'When should I start preparing?',
    a: '9 to 12 months before your intake. Enough time for tests, applications and the visa.',
  },
  {
    q: 'Do you help with scholarships and education loans?',
    a: 'Yes. We estimate your costs, find scholarships for you and connect you with loan partners.',
  },
  {
    q: 'What happens after I get my visa?',
    a: 'We help with housing, travel and forex, and check in during your first three months.',
  },
  {
    q: 'Can my parents follow my progress?',
    a: 'Yes. Invite them to your portal to follow your progress and pay fees.',
  },
];

export const contact = {
  email: 'contact@ahat.in',
  offices: ['Nagpur, India', 'London, United Kingdom'],
  hours: 'Mon–Sat, 10:00–19:00 IST',
};
