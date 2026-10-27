/**
 * Sample accounts loaded by the backend's demo data (`python -m app.seed`), shown on the login pages so
 * the portal can be tried without setting anything up. Hide them in production with VITE_SHOW_DEMO_HINTS=false.
 */
export const showDemoHints = import.meta.env.VITE_SHOW_DEMO_HINTS !== 'false';

export const DEMO_ACCOUNTS = {
  student: { email: 'demo.student@ahatin.example', label: 'Student' },
  /** A second student with nothing started yet, for trying the whole journey by hand. */
  freshStudent: { email: 'new.student@ahatin.example', label: 'New student (nothing started)' },
  counsellor: { email: 'demo.counsellor@ahatin.example', password: 'Staff@1234', label: 'Counsellor' },
  financeOfficer: { email: 'kavya.i@ahatin.example', password: 'Staff@1234', label: 'Financial Aid Officer' },
  visaOfficer: { email: 'aditya.r@ahatin.example', password: 'Staff@1234', label: 'Visa Officer' },
  admin: { email: 'demo.admin@ahatin.example', password: 'Admin@1234', label: 'Admin' },
} as const;
