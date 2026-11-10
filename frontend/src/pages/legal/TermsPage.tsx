import { Link } from 'react-router-dom';
import { Bullets, COMPANY, LegalPage, Mail, type LegalSection } from './LegalPage';

const link = 'font-medium text-navy-900 underline underline-offset-2';

const sections: LegalSection[] = [
  {
    id: 'about-us',
    title: 'About us',
    body: (
      <>
        <p>
          AHat (also written A-Hat) International Educational Consultancy is a trading name of <strong>{COMPANY.name}</strong>, a company registered in England and
          Wales (company number {COMPANY.number}), registered address {COMPANY.address}. We have offices in Nagpur, India and London, United Kingdom.
        </p>
        <p>“We”, “us” and “our” mean {COMPANY.name}, trading as AHat. “You” means anyone who uses our website or student portal.</p>
      </>
    ),
  },
  {
    id: 'these-terms',
    title: 'These terms',
    body: (
      <p>
        These terms apply when you use our website at ahat.in and the AHat student portal. By using them, or by creating an account, you agree to these terms. If you
        don't agree, please don't use the website or portal. Our <Link to="/privacy" className={link}>Privacy notice</Link> explains how we use your personal data.
      </p>
    ),
  },
  {
    id: 'our-services',
    title: 'Our services',
    body: (
      <>
        <p>We guide students who want to study in the United Kingdom and Europe. Our services include:</p>
        <Bullets
          items={[
            'career counselling and course selection;',
            'university and country selection;',
            'application assistance;',
            'scholarship and financial guidance;',
            'visa guidance;',
            'pre-departure and post-arrival support.',
          ]}
        />
        <p>The portal shows your progress, documents, sessions and messages with the people looking after you.</p>
      </>
    ),
  },
  {
    id: 'fees',
    title: 'Fees and how we are paid',
    body: (
      <>
        <p>Our guidance is free for students. Universities and partner agencies may pay us a commission when a student enrols. We always tell you which universities on your shortlist earn us commission.</p>
        <p>
          You pay any third-party costs directly to the organisation concerned. These can include application fees, tuition deposits, English test fees, visa fees, the
          immigration health surcharge, travel and accommodation.
        </p>
      </>
    ),
  },
  {
    id: 'guidance',
    title: 'Guidance, not guarantees',
    body: (
      <>
        <p>
          We give guidance to help you make your own decisions. Universities, scholarship providers, lenders and visa authorities make their own decisions, so we
          cannot guarantee an offer, a place, a scholarship, a loan or a visa.
        </p>
        <p>
          Our services are consultancy and guidance only. They are not legal, financial or immigration advice. Where you need such advice, we will suggest you speak to a
          suitably qualified adviser.
        </p>
        <p>
          Information on our website, such as rankings, scholarships, fees and visa rules, comes from public sources and can change at any time. Always check the
          details with the official source before you rely on them.
        </p>
      </>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <Bullets
        items={[
          'Give us information that is true, complete and up to date, and keep it updated.',
          'Keep your password private and don’t share your account. Tell us straight away if you think someone else has used it.',
          'Each student should have their own account.',
          'If you are under 18, please register only with the agreement of a parent or guardian.',
        ]}
      />
    ),
  },
  {
    id: 'documents',
    title: 'Your documents and applications',
    body: (
      <>
        <Bullets
          items={[
            'Upload only genuine documents that belong to you, or that you have permission to share.',
            'Check your applications and documents carefully. You are responsible for the information you give universities and other organisations.',
            'Reply to offers and meet deadlines. We will remind you, but the decision and the deadline are yours.',
          ]}
        />
        <p>
          If we believe a document is false or altered, we may stop working with you, close your account and, where the law requires it, tell the relevant university
          or authority.
        </p>
      </>
    ),
  },
  {
    id: 'parents',
    title: 'Parents and sponsors',
    body: (
      <p>
        You can invite a parent, guardian or sponsor to upload documents for you through a private link. They can only upload; they can't see your documents or the rest
        of your account. Please invite only people you trust, and remove their access when it is no longer needed.
      </p>
    ),
  },
  {
    id: 'sessions',
    title: 'Sessions and communication',
    body: (
      <>
        <p>You can book, join and cancel sessions with your counsellor and officers in the portal. If you can't make a session, please cancel it in advance so the time can be offered to another student.</p>
        <p>Please be respectful to our team. We may stop providing services to anyone who is abusive or threatening.</p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You must not:</p>
        <Bullets
          items={[
            'use the website or portal for anything unlawful, false or misleading;',
            'try to get into accounts or parts of the service that are not yours;',
            'upload anything harmful, such as viruses, or content that is offensive or not yours to share;',
            'copy, scrape or resell content or data from the website or portal; or',
            'interfere with the service or its security.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'content',
    title: 'Our content',
    body: (
      <p>
        The website, the portal and their content belong to {COMPANY.name} or the people who license it to us. You may use them for your own study plans, but you may not
        copy or reuse them for any other purpose without our written permission. University names and rankings belong to their owners and are shown for information only;
        they do not mean a university has a partnership with us.
      </p>
    ),
  },
  {
    id: 'other-websites',
    title: 'Other websites',
    body: <p>We link to other websites, such as universities and scholarship providers. We are not responsible for their content or how they use your information.</p>,
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep the website and portal available, but we cannot promise they will always be available or free of errors. We may change, suspend or stop parts of
        the service, for example for maintenance or improvements.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Our responsibility to you',
    body: (
      <>
        <p>
          Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited
          by law.
        </p>
        <p>
          Otherwise, we are not responsible for decisions made by universities, scholarship providers, lenders, visa authorities or other organisations, for losses
          caused by information you gave us being wrong, or for losses we could not reasonably have foreseen.
        </p>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Closing your account',
    body: (
      <p>
        You can stop using our services and ask us to close your account at any time by emailing <Mail />. We may suspend or close an account if these terms are broken.
        When an account is closed, we keep or delete your data as explained in our <Link to="/privacy" className={link}>Privacy notice</Link>.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: <p>We may update these terms from time to time. If we make important changes, we will tell you through the portal or by email. The date at the top shows when they were last updated.</p>,
  },
  {
    id: 'complaints',
    title: 'Questions and complaints',
    body: (
      <p>
        If you have a question or are unhappy with our service, email <Mail /> or write to {COMPANY.name}, {COMPANY.address}. We will acknowledge your complaint, look
        into it and reply to you.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of England and Wales, and the courts of England and Wales can deal with any dispute. If you live in another country, such as
        India, you may also have rights under the laws of that country, and you can bring a claim in your local courts.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="10 November 2026"
      intro={<p>The terms for using the AHat website and student portal. AHat is a trading name of {COMPANY.name}.</p>}
      sections={sections}
    />
  );
}
