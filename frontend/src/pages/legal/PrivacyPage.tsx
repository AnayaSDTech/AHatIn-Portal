import { Link } from 'react-router-dom';
import { Bullets, COMPANY, LegalPage, Mail, Table, type LegalSection } from './LegalPage';

const link = 'font-medium text-navy-900 underline underline-offset-2';

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          AHat (also written A-Hat) International Educational Consultancy is a trading name of <strong>{COMPANY.name}</strong>, a company registered in England and
          Wales (company number {COMPANY.number}). {COMPANY.name} is the data controller for the personal data described in this notice. We are registered with the UK
          Information Commissioner's Office (ICO) under registration number <strong>{COMPANY.ico}</strong>.
        </p>
        <Bullets
          items={[
            <>Registered address: {COMPANY.address}</>,
            <>Offices: Nagpur, India and London, United Kingdom</>,
            <>Email: <Mail /></>,
          ]}
        />
        <p>“We”, “us” and “our” in this notice mean {COMPANY.name}, trading as AHat.</p>
      </>
    ),
  },
  {
    id: 'scope',
    title: 'What this notice covers',
    body: (
      <>
        <p>This notice explains how we collect and use personal data when you:</p>
        <Bullets
          items={[
            'visit our website at ahat.in;',
            'send us an enquiry or ask us to call you back;',
            'chat with "Ask AHat", the AI assistant on our website;',
            'register for and use the AHat student portal, including as a parent;',
            'upload documents for a student through a private upload link they sent you; or',
            'are referred to us by a friend.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'The personal data we collect',
    body: (
      <>
        <p><strong>Information you give us</strong></p>
        <Bullets
          items={[
            <><strong>Enquiries:</strong> your name, email address, mobile number, where and when you would like to study, your course of interest, the best time to call and your message.</>,
            <><strong>Your account:</strong> your name, email address, mobile number and password (we store only a secure, scrambled version of your password).</>,
            <><strong>Your profile:</strong> such as your date of birth, where you live, your education history and grades, English test scores, work experience and study plans.</>,
            <><strong>Documents you upload:</strong> such as your passport, transcripts and certificates, test reports, CV, statement of purpose, references, bank statements, sponsor and loan letters, and visa documents.</>,
            <><strong>Your journey with us:</strong> your career plan, university shortlist and choices, applications and offers, funding plan and scholarships, visa progress, and travel and arrival details.</>,
            <><strong>Communications:</strong> messages you send in the portal, emails, the sessions you book and notes our team makes about them.</>,
            <><strong>People you invite:</strong> the name, email address and relationship of a parent, guardian or sponsor you invite to upload documents, and the files they upload.</>,
            <><strong>Referrals:</strong> the name and email address of a friend you refer to us.</>,
            <>
              <strong>Chat messages:</strong> what you type to "Ask AHat", our AI assistant, its answers, and whether you marked an answer helpful. Please don't share
              passport numbers, bank details or other sensitive information in the chat. If you ask for a call back from the chat, your name, mobile number and email
              go straight to us through the call-back form, not to the AI.
            </>,
          ]}
        />
        <p><strong>Information we collect automatically</strong></p>
        <Bullets
          items={[
            'Your IP address and basic browser and device details, which our servers record to keep the service secure and to prevent misuse.',
            'Two small cookies that keep you signed in and protect forms (see section 9).',
          ]}
        />
        <p><strong>Information from others</strong></p>
        <Bullets
          items={[
            'Updates from universities and partner agencies about your applications, offers and enrolment.',
            'Documents a parent, guardian or sponsor uploads for you through a link you sent them.',
            'Your details from a friend who referred you to us.',
          ]}
        />
        <p><strong>Sensitive information</strong></p>
        <p>
          We don't ask for sensitive information such as your health, religion or ethnic origin. Some documents may contain it, for example a medical or TB test
          certificate needed for a visa. We only handle this where it is needed for your application or visa and you have chosen to give it to us. When you check your
          eligibility on Explore Scholarships, optional answers such as your category, family income or disability are used only to show your results and are not
          saved to your profile.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your data and our legal reasons',
    body: (
      <>
        <p>Under UK data protection law we must have a lawful basis for each use of your personal data. We use it to:</p>
        <Table
          head={['What we use it for', 'Lawful basis']}
          rows={[
            ['Reply to your enquiry and call you back', 'Steps you have asked us to take before using our services; our legitimate interests in answering enquiries'],
            ['Answer your questions in the "Ask AHat" chat, and review chats to improve its answers and prevent misuse', 'Our legitimate interests in answering questions about our services'],
            ['Provide our services: counselling, shortlisting, applications, scholarships and funding guidance, visa guidance, and pre-departure and arrival support', 'Performance of our agreement with you'],
            ['Send your applications to universities and partner agencies, and follow up with them', 'Performance of our agreement with you'],
            ['Send you sign-in codes, reminders and updates about your account and journey', 'Performance of our agreement with you'],
            ['Let a parent, guardian or sponsor you invite upload documents for you', 'Performance of our agreement with you, at your request'],
            ['Send one invitation email to a friend you refer', 'Our legitimate interests, at your request'],
            ['Handle sensitive information in documents needed for your application or visa', 'Your explicit consent, which you can withdraw at any time'],
            ['Keep the service secure, prevent fraud and misuse, and improve our services', 'Our legitimate interests'],
            ['Keep records, and meet our legal and regulatory obligations', 'Legal obligation'],
            ['Send you news and offers about our services', 'Your consent, which you can withdraw at any time'],
          ]}
        />
        <p>
          We do not make decisions about you based only on automated processing. Suggestions in the portal, such as matching courses or scholarships, and answers from
          the "Ask AHat" AI assistant are guidance only, and our team makes the decisions that matter. The AI assistant can make mistakes, so please check anything
          important with your counsellor.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share your data with',
    body: (
      <>
        <p>We never sell your personal data. We share it only where needed:</p>
        <Bullets
          items={[
            <><strong>Universities and colleges</strong> you choose to apply to, and the <strong>partner agencies</strong> we apply through.</>,
            <><strong>Scholarship providers and education loan partners</strong>, when you ask us to help you apply.</>,
            <><strong>People you invite</strong> to upload documents. They can only upload; they can't see your documents or the rest of your account.</>,
            <>
              <strong>Service providers</strong> who run parts of our service for us under contract, including website and server hosting (Hostinger and Render), our
              database (MongoDB Atlas), document storage (Backblaze), email delivery (Resend) and session calendars (Google).
            </>,
            <>
              <strong>Our AI provider</strong> (Groq), which writes the "Ask AHat" chat's answers. It receives the messages in your chat, but not your account,
              documents or call-back details.
            </>,
            <><strong>Professional advisers</strong>, such as lawyers and accountants, where needed.</>,
            <><strong>Authorities</strong>, such as the police, courts or regulators, where the law requires it.</>,
            <>A buyer or successor, if our business or part of it is ever sold or merged.</>,
          ]}
        />
        <p>
          Our guidance is free for students. Universities and partner agencies may pay us a commission when a student enrols. We always tell you which universities on
          your shortlist earn us commission.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'International transfers',
    body: (
      <p>
        We work in India and the United Kingdom, and your applications go to universities in the UK and Europe. Some of our service providers store data in other
        countries, including the United States, where our AI provider processes chat messages. When personal data leaves the UK, we make sure it is protected, for example by sending it only to countries the UK
        recognises as adequate or by using the UK's approved data transfer agreements. Sending your application to a university abroad is necessary to provide the
        service you have asked for.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep your data',
    body: (
      <>
        <p>We keep personal data only for as long as we need it:</p>
        <Bullets
          items={[
            'Your account, profile, documents and records: while your account is open and for up to six years after our last contact with you, so we can answer questions or complaints and meet legal requirements.',
            'Enquiries that do not lead to an account: for up to two years after our last contact.',
            '"Ask AHat" chats: deleted automatically 30 days after the chat starts. A call-back request made from the chat is kept as an enquiry.',
            'Sign-in codes expire after 10 minutes, invitation links when their time runs out, and unfinished uploads are removed within a day.',
          ]}
        />
        <p>After that, we delete your data or make it anonymous.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we keep your data safe',
    body: (
      <Bullets
        items={[
          'Everything sent between your device and us is encrypted (HTTPS).',
          'Passwords are stored only in a secure, scrambled form, and staff sign in with an authenticator app as well as a password.',
          'Staff see only the students and information they need for their role.',
          'Uploaded documents are kept in private storage and checked before our team uses them.',
        ]}
      />
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and similar technologies',
    body: (
      <>
        <p>We use only the cookies needed to run the website and portal. We don't use advertising or tracking cookies.</p>
        <Table
          head={['Cookie', 'What it does']}
          rows={[
            [<code>ahat_session</code>, 'Keeps you signed in to the portal. It ends when you sign out or after a period of inactivity.'],
            [<code>ahat_csrf</code>, 'Protects your account by checking that changes really come from you.'],
          ]}
        />
        <p>
          Your browser may also keep a copy of the website so it loads faster. Fonts (Google Fonts) and some photos (Unsplash) load from those companies' servers, which
          receive your IP address in the usual way. You can clear cookies and stored data in your browser settings at any time; if you do, you will need to sign in again.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>You have the right to:</p>
        <Bullets
          items={[
            'be told how we use your data (this notice);',
            'ask for a copy of your data;',
            'ask us to correct data that is wrong or incomplete;',
            'ask us to delete your data;',
            'ask us to limit how we use your data;',
            'receive your data in a format you can take elsewhere;',
            'object to how we use your data, including an absolute right to object to marketing; and',
            'withdraw your consent at any time, where we rely on it.',
          ]}
        />
        <p>
          If you are in India, you also have rights under the Digital Personal Data Protection Act, 2023, including to access, correct and erase your data, to have a
          grievance addressed and to nominate someone to act for you.
        </p>
        <p>
          To use any of these rights, email <Mail />. We will reply within one month. There is usually no charge. We may need to confirm your identity first.
        </p>
      </>
    ),
  },
  {
    id: 'young-people',
    title: 'Students under 18',
    body: <p>If you are under 18, please involve a parent or guardian before registering, and make sure they are happy for you to share your information with us.</p>,
  },
  {
    id: 'other-websites',
    title: 'Other websites',
    body: <p>Our website links to other websites, such as universities and scholarship providers. This notice does not cover them, so please read their own privacy notices.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this notice',
    body: <p>We review this notice regularly. If we make important changes, we will tell you through the portal or by email. The date at the top shows when it was last updated.</p>,
  },
  {
    id: 'contact',
    title: 'Contact us and complaints',
    body: (
      <>
        <p>
          If you have a question or concern about your personal data, email <Mail /> or write to us at {COMPANY.name}, {COMPANY.address}. We will try to resolve it.
        </p>
        <p>You also have the right to complain to the UK Information Commissioner's Office (ICO):</p>
        <Bullets
          items={[
            "Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF",
            'Telephone: 0303 123 1113',
            <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer" className={link}>ico.org.uk/make-a-complaint</a>,
          ]}
        />
        <p>If you are in India, you may also raise a grievance with us at <Mail />, and then with the Data Protection Board of India.</p>
        <p>
          Please also read our <Link to="/terms" className={link}>Terms of use</Link>.
        </p>
      </>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="11 November 2026"
      intro={<p>How AHat, a trading name of {COMPANY.name}, collects, uses and protects your personal data.</p>}
      sections={sections}
    />
  );
}
