import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { CONTACT_EMAIL } from '../config/contact.js';

/**
 * Privacy policy.
 *
 * Google requires a reachable privacy policy URL before an OAuth app can be
 * published, but more importantly this has to be true: every claim here was
 * checked against what the code stores and sends. If the data model changes,
 * this page changes with it.
 */

const Section = ({ title, children }) => (
  <section className="mt-9">
    <h2 className="text-lg font-semibold text-content-primary">{title}</h2>
    <div className="mt-3 space-y-4">{children}</div>
  </section>
);

const COOKIES = [
  ['ch_access', 'Keeps you signed in. It is short-lived.'],
  ['ch_refresh', 'Renews your session so you are not logged out all the time. Lasts 30 days.'],
  ['ch_oauth', 'Only exists for 10 minutes while you sign in with Google, then it is deleted.'],
];

export const PrivacyPage = () => (
  <PageTransition>
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Privacy" description="Last updated October 2026" />

      <div className="text-[0.9375rem] leading-7 text-content-secondary">
        <p>
          CodeHub is a student project and I built it, so this page is written by me and not by a
          legal team. I tried to say only things I could check against the code. There are no
          analytics, no ads and no tracking scripts anywhere in the website.
        </p>

        <Section title="What I collect">
          <p>
            If you make an account, I store your email, a username and, if you fill them in, a
            display name, a short bio and an avatar URL. Your password is kept only as a bcrypt
            hash, so I cannot read it. If you sign in with Google, the account has no password at
            all. I ask Google for just <span className="font-mono text-[0.875em]">openid email profile</span>,
            and I keep the Google account id, your email, your name and your picture.
          </p>
          <p>
            As you use the app I also store your preferences, the Codeforces, LeetCode and CodeChef
            usernames you link, your bookmarks and notes, and your contest reminders. To keep the
            dashboard working when a platform is slow or down, I cache the public stats I fetched
            for you. Practice next remembers which problems it has already suggested so it does not
            repeat itself.
          </p>
        </Section>

        <Section title="What I do with it">
          <p>
            It is used to run the app, and nothing else. Your profile is private by default. If you
            turn on sharing, people can see your username, the usernames you linked, your ratings,
            solved counts, top topics and activity at{' '}
            <span className="font-mono text-[0.875em]">/u/username</span>. Your email stays hidden
            unless you also tick the box to show it.
          </p>
          <p>
            The only emails I send are contest reminders you ask for. There is no newsletter.
          </p>
        </Section>

        <Section title="Who else touches it">
          <p>
            Codeforces, LeetCode and CodeChef get a request for the public profile of each username
            you link. clist.by supplies the contest list. Google is involved only if you use Google
            sign-in. The database is on MongoDB Atlas, the server runs on Render and the website is
            served by Vercel. Each of them has its own privacy policy.
          </p>
          <p>
            CodeHub is a hobby project and it has not had a professional security audit, so please
            do not reuse an important password here.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            There are no advertising or analytics cookies. The three cookies below are only for
            signing in, and all of them are httpOnly, which means scripts on the page cannot read
            them.
          </p>
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised text-content-primary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Cookie
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    What it does
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {COOKIES.map(([name, text]) => (
                  <tr key={name} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs text-content-primary">{name}</td>
                    <td className="px-3 py-2">{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Your theme and reduced-motion choices are saved in your browser&apos;s local storage on
            your own device.
          </p>
        </Section>

        <Section title="Your choices and deleting your data">
          <p>
            Inside the app you can unlink a platform username, delete bookmarks and notes, and
            cancel reminders. You can also leave sharing off and your profile stays private.
          </p>
          <p>
            There is no button to delete a whole account yet. For now, email me at the address
            below and I will delete the account.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or a deletion request? Write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-link">
              {CONTACT_EMAIL}
            </a>
            . The code is public on{' '}
            <a
              href="https://github.com/shivam4saurav/codehub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              GitHub
            </a>
            , so you can check any of this yourself.
          </p>
        </Section>
      </div>
    </section>
  </PageTransition>
);

export default PrivacyPage;
