import { Link } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import Button from '../components/ui/Button.jsx';

export const NotFoundPage = () => (
  <PageTransition>
    <section className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-5 sm:px-6">
      <p className="font-mono text-sm text-content-muted">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-content-primary">
        Nothing at this address
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-content-secondary">
        The link may be old, or the profile you are looking for is private.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button as={Link} to="/">
          Go home
        </Button>
        <Button as={Link} to="/practice" variant="secondary">
          Practice next
        </Button>
      </div>
    </section>
  </PageTransition>
);

export default NotFoundPage;
