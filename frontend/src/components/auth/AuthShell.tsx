import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SmartImage } from '../ui/SmartImage';
import { images } from '../../data/site';

/** Two-column layout for login and registration: form on the left, brand panel on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <section className="min-h-screen pt-24">
      <div className="mx-auto grid max-w-7xl lg:min-h-[calc(100vh-6rem)] lg:grid-cols-2">
        <div className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-md animate-fade-up">
            <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p className="mt-3 text-navy-600">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden lg:m-6 lg:block lg:rounded-[2rem]">
          <SmartImage src={images.campus} alt="" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/30 via-navy-950/80 to-navy-950/30" aria-hidden />
          <div className="absolute inset-0 flex flex-col justify-center p-12 text-white">
            <p className="font-display text-3xl leading-snug">Everything about your application, in one place.</p>
            <ul className="mt-6 space-y-3 text-sm text-navy-100">
              {[
                'See your progress at every stage of your journey',
                'Upload documents and track verification',
                'Never miss an application or visa deadline',
                'Message your counsellor any time',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-gold-400" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
