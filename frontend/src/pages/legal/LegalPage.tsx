import { useEffect, type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { Container } from '../../components/ui/Container';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** The company behind AHat, shown on every legal page. */
export const COMPANY = {
  name: 'AnayaSD Limited',
  number: '09674951',
  ico: 'ZB914599',
  address: '15 Crabbe Crescent, Chesham, HP5 3DD, United Kingdom',
  email: 'contact@ahat.in',
};

/** Shared layout for the Privacy notice and Terms of use: title, contents and numbered sections. */
export function LegalPage({ title, intro, updated, sections }: { title: string; intro: ReactNode; updated: string; sections: LegalSection[] }) {
  useEffect(() => {
    document.title = `${title} · AHat`;
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [title]);

  return (
    <article className="pb-24 pt-28 sm:pt-32">
      <Container>
        <div className="mx-auto max-w-4xl">
        <header className="rounded-3xl bg-navy-950 px-6 py-10 text-white sm:px-10">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/30">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-5 text-3xl text-white sm:text-4xl">{title}</h1>
          <div className="mt-3 max-w-2xl text-navy-100">{intro}</div>
          <p className="mt-5 text-xs uppercase tracking-wider text-gold-300">Last updated {updated}</p>
        </header>

        <nav aria-label="On this page" className="mt-8 rounded-2xl border border-navy-100 bg-white p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">On this page</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-navy-700 hover:text-gold-700">
                  <span className="mr-1.5 text-navy-400">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 space-y-4">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 rounded-2xl border border-navy-100 bg-white p-6 sm:p-8">
              <h2 className="flex items-baseline gap-3 font-sans text-lg font-semibold text-navy-900">
                <span className="font-display text-gold-600">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-navy-700">{s.body}</div>
            </section>
          ))}
        </div>
        </div>
      </Container>
    </article>
  );
}

/** A bulleted list in the legal pages' style. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A small two-column table, e.g. purposes and lawful bases. */
export function Table({ head, rows }: { head: [string, string]; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-ivory text-[11px] uppercase tracking-wider text-navy-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">{head[0]}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {rows.map(([a, b], i) => (
            <tr key={i} className="align-top">
              <td className="px-4 py-3 text-navy-800">{a}</td>
              <td className="px-4 py-3 text-navy-600">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Mail = () => (
  <a href={`mailto:${COMPANY.email}`} className="font-medium text-navy-900 underline underline-offset-2">
    {COMPANY.email}
  </a>
);
