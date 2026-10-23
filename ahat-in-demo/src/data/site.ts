import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  GraduationCap,
  FileText,
  Coins,
  Stamp,
  Luggage,
  HeartHandshake,
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
    tagline: 'One-year master’s degrees and world-famous universities',
    image: img('photo-1513635269975-59663e0ac1ad', 900),
    highlights: ['1-year master’s programmes', 'Graduate Route work visa', 'Scholarships for Indian students'],
    intakes: 'September · January',
  },
  {
    name: 'Europe',
    tagline: 'Germany, Ireland and France: quality education, lower costs',
    image: img('photo-1502602898657-3e91760cbb34', 900),
    highlights: ['Low or no tuition in Germany', 'English-taught programmes', 'Post-study work in Ireland'],
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
    description: 'We understand your strengths and goals, then recommend courses that lead to the career you want.',
    icon: Compass,
  },
  {
    code: 'S2',
    title: 'University & Country Selection',
    description: 'Compare countries on cost, work rights and visas, and build a shortlist that fits your profile and budget.',
    icon: GraduationCap,
  },
  {
    code: 'S3',
    title: 'Application Assistance',
    description: 'SOP, LOR and CV guidance, complete applications, and help comparing and accepting offers.',
    icon: FileText,
  },
  {
    code: 'S4',
    title: 'Scholarship & Financial Guidance',
    description: 'Scholarship search, a clear cost-of-study estimate, funding plans and proof-of-funds planning.',
    icon: Coins,
  },
  {
    code: 'S5',
    title: 'Visa Assistance',
    description: 'Visa checklists, financial-document checks, form review and mock interviews.',
    icon: Stamp,
  },
  {
    code: 'S6',
    title: 'Pre-Departure Support',
    description: 'Accommodation, travel, forex, insurance and a clear plan for your first week abroad.',
    icon: Luggage,
  },
  {
    code: 'S7',
    title: 'Post-Arrival Support',
    description: 'Safe-arrival check, local registration help and regular check-ins during your first months.',
    icon: HeartHandshake,
  },
];

export const aboutPoints = [
  { title: 'Always free for students', text: 'Our guidance costs you nothing, from first conversation to settling in.' },
  { title: 'One named counsellor', text: 'A dedicated counsellor stays with you through every step.' },
  { title: 'Honest, transparent advice', text: 'We tell you which universities earn us commission, so you can decide with confidence.' },
  { title: 'Your progress, always visible', text: 'Track every application, document and deadline in your student portal.' },
];

/**
 * DEMO: examples of universities Indian students commonly apply to.
 * Shown for illustration only; not a claim of direct partnership.
 */
export const universities = [
  { name: 'University of Manchester', country: 'United Kingdom', city: 'Manchester', programmes: 'Business, Data Science, Engineering' },
  { name: 'University of Leeds', country: 'United Kingdom', city: 'Leeds', programmes: 'Management, Computing, Public Health' },
  { name: 'King’s College London', country: 'United Kingdom', city: 'London', programmes: 'Law, Health, Digital Humanities' },
  { name: 'University of Glasgow', country: 'United Kingdom', city: 'Glasgow', programmes: 'Computing, Engineering, Business' },
  { name: 'RWTH Aachen University', country: 'Germany', city: 'Aachen', programmes: 'Engineering, Computer Science' },
  { name: 'Technical University of Munich', country: 'Germany', city: 'Munich', programmes: 'Engineering, Informatics' },
  { name: 'Trinity College Dublin', country: 'Ireland', city: 'Dublin', programmes: 'Computer Science, Business, Biotech' },
  { name: 'University College Dublin', country: 'Ireland', city: 'Dublin', programmes: 'Business Analytics, Finance' },
];

/** DEMO: fictional student stories. */
export const testimonials = [
  {
    name: 'Riya Mehta',
    from: 'Pune',
    outcome: 'MSc Data Science · United Kingdom',
    quote:
      'My counsellor helped me choose a course that matched my career plan, and the portal showed me exactly what to do next. I never had to chase anyone for updates.',
  },
  {
    name: 'Arjun Nair',
    from: 'Kochi',
    outcome: 'MSc Computer Science · United Kingdom',
    quote:
      'The mock credibility interviews made all the difference. I felt prepared on the call, and my UK Student visa was approved on the first attempt.',
  },
  {
    name: 'Sneha Kulkarni',
    from: 'Nagpur',
    outcome: 'MSc Mechanical Engineering · Germany',
    quote:
      'From APS to my blocked account and finding accommodation, every step was planned. They even checked in after I arrived in Munich.',
  },
];

export const faqs = [
  {
    q: 'Is AHatIn’s guidance really free?',
    a: 'Yes. Our counselling and application support are free for students. Universities and our partner agencies pay us when a student enrols, and we always tell you which universities earn us commission.',
  },
  {
    q: 'Which countries do you help with?',
    a: 'We guide students to the United Kingdom and Europe, mainly Germany, Ireland and France.',
  },
  {
    q: 'When should I start preparing?',
    a: 'Ideally 9 to 12 months before your intake. That leaves time for tests, applications, scholarships and the visa without rushing.',
  },
  {
    q: 'Do you help with scholarships and education loans?',
    a: 'Yes. We estimate your full cost of study, help you build a funding plan, find scholarships you are eligible for, and connect you with loan partners if you need one.',
  },
  {
    q: 'What happens after I get my visa?',
    a: 'We help with accommodation, travel and forex, confirm you have arrived safely, and check in during your first three months abroad.',
  },
  {
    q: 'Can my parents follow my progress?',
    a: 'Yes. You can invite parents to the student portal, where they can see your progress and pay fees such as visa or application fees.',
  },
];

export const contact = {
  // DEMO contact details
  phone: '+91 98000 00000',
  email: 'hello@ahatin.example',
  address: 'Demo Office, 2nd Floor, MG Road, Pune 411001',
  hours: 'Mon–Sat, 10:00–19:00 IST',
};
