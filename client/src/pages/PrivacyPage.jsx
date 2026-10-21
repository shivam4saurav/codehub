import { Link } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';

/**
 * Privacy policy.
 *
 * Google requires a reachable privacy policy URL before an OAuth app can be
 * published, but more importantly this has to be *true*: every claim here is
 * checked against what the code actually stores and sends. If the data model
 * changes, this page changes with it.
 */

const Section = ({ title, children }) => (
  <section className="border-b border-edge py-6 last:border-b-0">
    <h2 className="text-base font-semibold text-content-primary">{title}</h2>
    <div className="mt-2 space-y-3 text-[0.9375rem] leading-relaxed text-content-secondary">
      {children}
    </div>
  </section>
);

const Row = ({ label, children }) => (
  <div className="grid gap-1 py-2.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-sm font-medium text-content-primary">{label}</dt>
    <dd className="text-sm text-content-secondary">{children}</dd>
  </div>
);

export const PrivacyPage = () => (
  <PageTransition>
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Last updated October 2026"
        title="Privacy"
        description="CodeHub is a student project. This page explains exactly what it stores, what it sends to other services, and what it does not do."
      />

      <Section title="The short version">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>No analytics, no advertising, no tracking scripts of any kind.</li>
          <li>Your data is never sold or shared for marketing.</li>
          <li>Your profile is private by default; sharing is opt-in from Settings.</li>
          <li>You can use the dashboard, problems and contests without an account at all.</li>
        </ul>
      </Section>

      <Section title="What is stored when you create an account">
        <dl className="divide-y divide-edge">
          <Row label="Email address">
            Used to sign in and to send contest reminders you ask for. Nothing else.
          </Row>
          <Row label="Username">
            Also your public profile address, if you ever enable sharing.
          </Row>
          <Row label="Password">
            Stored only as a bcrypt hash. The plain password is never written down and cannot be
            recovered from what is stored. Accounts created through Google have no password.
          </Row>
          <Row label="Google account id">
            If you sign in with Google: a Google-issued account identifier, plus the email, name
            and profile picture Google returns. CodeHub requests nothing beyond
            <span className="font-mono"> openid email profile</span>, so it has no access to your
            Gmail, Drive, contacts or anything else.
          </Row>
          <Row label="Profile details">Display name, bio and avatar URL, if you set them.</Row>
          <Row label="Preferences">Theme and reduced-motion choices, and whether reminder emails are on.</Row>
        </dl>
      </Section>

      <Section title="What is stored as you use it">
        <dl className="divide-y divide-edge">
          <Row label="Platform usernames">
            The Codeforces, LeetCode and CodeChef usernames you add.
          </Row>
          <Row label="Bookmarks and notes">Problems you save, notes you write, items you tick off.</Row>
          <Row label="Contest reminders">
            Which contest, how long before it starts, and whether the email was sent.
          </Row>
          <Row label="Cached platform data">
            Your public stats from those platforms (ratings, solved counts, activity). This is
            saved so the dashboard still works when a platform is down or slow.
          </Row>
          <Row label="Suggestion history">
            Which problems Practice next has already recommended, so it does not repeat itself.
          </Row>
        </dl>
      </Section>

      <Section title="Cookies">
        <p>
          CodeHub sets no advertising or analytics cookies. The only cookies are for signing in,
          and all of them are <span className="font-mono">httpOnly</span>, meaning JavaScript on
          the page cannot read them:
        </p>
        <dl className="divide-y divide-edge">
          <Row label="ch_access">Keeps you signed in. Short-lived.</Row>
          <Row label="ch_refresh">Renews your session so you are not logged out constantly.</Row>
          <Row label="ch_oauth">
            Exists for ten minutes during a Google sign-in to protect the exchange, then is
            deleted.
          </Row>
        </dl>
        <p>
          Your theme and reduced-motion settings are kept in your browser&apos;s local storage, not
          sent to the server.
        </p>
      </Section>

      <Section title="Other services involved">
        <p>Using CodeHub means data passes through these, each under its own privacy policy:</p>
        <dl className="divide-y divide-edge">
          <Row label="Codeforces, LeetCode, CodeChef">
            Contacted to read the public profile data for the usernames you provide.
          </Row>
          <Row label="clist.by">Used to list LeetCode and CodeChef contests.</Row>
          <Row label="Google">Only if you choose to sign in with Google.</Row>
          <Row label="MongoDB Atlas">Where the database lives.</Row>
          <Row label="Render and Vercel">Hosting for the server and the website.</Row>
        </dl>
        <p>
          CodeHub only ever sends these services the minimum needed: a username to look up, or a
          contest list request. It does not send them your email or your notes.
        </p>
      </Section>

      <Section title="Email">
        <p>
          Your email is used for two things: signing in, and contest reminders if you set them.
          There are no newsletters or marketing emails. You can switch reminder emails off entirely
          in <Link to="/settings" className="text-link">Settings</Link>.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can remove most things yourself at any time: unlink platform usernames, delete
          bookmarks and notes, and cancel reminders, all from inside the app.
        </p>
        <p>
          There is no self-service button to delete a whole account yet. Until there is, email the
          address below and the account and everything attached to it will be deleted.
        </p>
      </Section>

      <Section title="Being honest about what this is">
        <p>
          CodeHub is a university project built by one student, not a company. It runs on free
          hosting tiers. It is built carefully - passwords are hashed, sessions use httpOnly
          cookies, profiles are private by default - but it has not had a professional security
          audit, so please do not reuse an important password here.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, or want your data deleted? Email{' '}
          <a href="mailto:shivamsaurav45@gmail.com" className="text-link">
            shivamsaurav45@gmail.com
          </a>
          . The source code is{' '}
          <a
            href="https://github.com/shivam4saurav/codehub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            public on GitHub
          </a>{' '}
          if you would rather verify any of this yourself.
        </p>
      </Section>
    </section>
  </PageTransition>
);

export default PrivacyPage;
