import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Mail, Phone, Send } from 'lucide-react';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/FormField';
import { contact } from '../../data/site';
import { enquirySchema, type EnquiryForm } from '../../lib/validation';
import { callTimes, enquiryDestinations, enquiryIntakes, submitEnquiry, type EnquiryResult } from '../../lib/enquiry';
import { ApiError } from '../../lib/api/types';

const blank: EnquiryForm = { name: '', email: '', mobile: '', destination: '', intake: '', course: '', callTime: '', message: '', consent: false, website: '' };

function ThankYou({ name, result, onAgain }: { name: string; result: EnquiryResult; onAgain: () => void }) {
  const first = name.trim().split(/\s+/)[0];
  const text =
    result.kind === 'student'
      ? result.counsellor
        ? `You already have an AHat account, so we've passed this to your counsellor, ${result.counsellor}, who will get back to you. You can also log in to see your progress.`
        : "You already have an AHat account, so we've added this to your record and the AHat team will get back to you. You can also log in to see your progress."
      : result.kind === 'lead'
        ? `We've added this to your earlier enquiry. ${result.counsellor ?? 'The AHat team'} will call you to talk it through.`
        : `The AHat team will call you on your mobile within working hours (${contact.hours}).`;
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center py-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="mt-5 text-2xl text-navy-900">Thank you, {first}!</h3>
      <p className="mx-auto mt-3 max-w-sm text-navy-600">{text}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {result.kind === 'student' ? (
          <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-800">
            Log in <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-800">
            Create your free account now <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <Button type="button" variant="outline" onClick={onAgain}>Send another enquiry</Button>
      </div>
    </div>
  );
}

/** Homepage enquiry form: visitors ask for a call back without registering. Each enquiry becomes a lead for the admin to handle. */
export function Enquiry() {
  const [params] = useSearchParams();
  const [done, setDone] = useState<{ name: string; result: EnquiryResult } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryForm>({ resolver: zodResolver(enquirySchema), defaultValues: blank });

  // "Get guidance" on a destination card pre-selects that destination.
  const preset = params.get('destination');
  useEffect(() => {
    if (preset && enquiryDestinations.some((d) => d.value === preset)) setValue('destination', preset);
  }, [preset, setValue]);

  const messageLength = watch('message')?.length ?? 0;

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const result = await submitEnquiry(data);
      setDone({ name: data.name, result });
      reset(blank);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again, or call us.');
    }
  });

  return (
    <section id="enquire" className="scroll-mt-24 bg-ivory py-24 sm:py-32">
      <Container>
        <Reveal>
          <div className="grid overflow-hidden rounded-[2rem] bg-white shadow-lift lg:grid-cols-12">
            {/* Why enquire */}
            <div className="relative overflow-hidden bg-navy-950 p-8 text-white sm:p-12 lg:col-span-5">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" aria-hidden />
              <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Free enquiry</p>
              <h2 className="relative mt-4 text-3xl leading-tight text-white sm:text-4xl">
                Have a question? <span className="italic text-gold-400">Ask a counsellor.</span>
              </h2>
              <p className="relative mt-4 text-navy-100">
                No account needed. Tell us a little about your plans and a counsellor will call you back, usually on the same working day.
              </p>
              <ul className="relative mt-8 space-y-3 text-sm text-navy-100">
                {['Free, with no obligation to register', 'Honest advice on the UK and Europe', 'One counsellor who stays with you'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="relative mt-10 space-y-3 border-t border-white/10 pt-8 text-sm">
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 text-white hover:text-gold-300">
                  <Phone className="h-4 w-4 text-gold-400" aria-hidden /> {contact.phone}
                </a>
                <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-white hover:text-gold-300">
                  <Mail className="h-4 w-4 text-gold-400" aria-hidden /> {contact.email}
                </a>
                <p className="flex items-center gap-3 text-navy-200">
                  <Clock className="h-4 w-4 text-gold-400" aria-hidden /> {contact.hours}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-12 lg:col-span-7">
              {done ? (
                <ThankYou name={done.name} result={done.result} onAgain={() => setDone(null)} />
              ) : (
                <form onSubmit={onSubmit} noValidate className="relative space-y-5" aria-label="Enquiry form">
                  {formError && (
                    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                      {formError}
                    </div>
                  )}
                  <TextField label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" hint="We'll call you on this number" error={errors.mobile?.message} {...register('mobile')} />
                    <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField label="Where would you like to study?" placeholder="Choose one" options={enquiryDestinations} error={errors.destination?.message} {...register('destination')} />
                    <SelectField label="When would you like to start?" placeholder="Choose one" options={enquiryIntakes} error={errors.intake?.message} {...register('intake')} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField label="Course or subject (optional)" placeholder="e.g. MSc Data Science" error={errors.course?.message} {...register('course')} />
                    <SelectField label="Best time to call (optional)" options={callTimes} {...register('callTime')} />
                  </div>
                  <div>
                    <label htmlFor="enquiry-message" className="mb-1.5 block text-sm font-medium text-navy-800">Your question (optional)</label>
                    <textarea
                      id="enquiry-message"
                      rows={3}
                      maxLength={500}
                      className="input resize-none"
                      placeholder="Tell us what you'd like help with"
                      aria-invalid={!!errors.message}
                      {...register('message')}
                    />
                    <p className="mt-1.5 text-right text-xs text-navy-400">{messageLength}/500</p>
                  </div>
                  {/* Spam trap: hidden from people, often filled in by bots. */}
                  <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
                    <label htmlFor="enquiry-website">Website</label>
                    <input id="enquiry-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
                  </div>
                  <div>
                    <label className="flex items-start gap-3 text-sm leading-relaxed text-navy-700">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded border-navy-300 accent-navy-900" aria-invalid={!!errors.consent} {...register('consent')} />
                      <span>
                        I agree that AHat may contact me by phone, email or WhatsApp about my enquiry, as described in the{' '}
                        <a href="#" className="font-medium text-navy-900 underline underline-offset-2">Privacy notice</a>.
                      </span>
                    </label>
                    {errors.consent && <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.consent.message}</p>}
                  </div>
                  <Button type="submit" variant="gold" size="lg" className="w-full" loading={isSubmitting}>
                    Request a call back <Send className="h-4 w-4" aria-hidden />
                  </Button>
                  <p className="text-center text-xs text-navy-400">We use your details only to contact you about your enquiry.</p>
                </form>
              )}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
