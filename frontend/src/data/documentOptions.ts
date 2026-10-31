import type { DocCategory } from './staff';
import type { ServiceCode } from '../lib/journey';

/** The documents staff can request at each stage of the journey, and the part of the checklist they go in. */
export const STAGE_DOCUMENTS: Record<ServiceCode, { category: DocCategory; options: string[] }> = {
  S1: {
    category: 'general',
    options: ['10th marksheet', '12th marksheet', 'Diploma certificate', 'Degree marksheets', 'Provisional degree certificate', 'Updated CV', 'Passport (first and last page)', 'Work experience letter'],
  },
  S3: {
    category: 'general',
    options: [
      'Statement of Purpose (SOP)',
      'Letter of Recommendation (academic)',
      'Letter of Recommendation (professional)',
      'English test score report',
      'Medium of Instruction certificate',
      'Academic transcripts',
      'Degree certificate',
      'Work experience letter',
      'Portfolio',
      'Application fee receipt',
    ],
  },
  S4: {
    category: 'funds',
    options: [
      'Bank statement (28 days)',
      'Bank balance certificate',
      'Education loan sanction letter',
      'Blocked account confirmation',
      'Sponsor letter',
      "Sponsor's income proof",
      'Income tax returns (last 3 years)',
      'Fixed deposit certificate',
      'Scholarship award letter',
      'Tuition deposit receipt',
    ],
  },
  S5: {
    category: 'visa',
    options: [
      'CAS or admission letter',
      'Passport (all pages)',
      'Passport-size photographs',
      'Visa application form',
      'TB test certificate',
      'Medical certificate',
      'Police clearance certificate',
      'Visa fee receipt',
      'Health surcharge receipt',
      'Biometrics appointment confirmation',
    ],
  },
  S6: {
    category: 'visa',
    options: ['Visa copy', 'Flight ticket', 'Accommodation confirmation', 'Travel and health insurance', 'Forex card or bank account proof', 'Pre-departure briefing confirmation'],
  },
  S7: {
    category: 'visa',
    options: ['University enrolment confirmation', 'Student ID card', 'Residence permit', 'Proof of local address', 'Local bank account confirmation'],
  },
};

/** Everything that can be requested for one part of the checklist, without repeats. */
export const documentsForCategory = (category: DocCategory) =>
  Array.from(new Set(Object.values(STAGE_DOCUMENTS).flatMap((s) => (s.category === category ? s.options : []))));
