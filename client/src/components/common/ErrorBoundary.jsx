import { Component } from 'react';
import { RotateCcw } from 'lucide-react';

import Button from '../ui/Button.jsx';

/**
 * Route-level error boundary. A render crash in one page must not take the
 * whole SPA down to a white screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CodeHub render error', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="rounded-2xl border border-state-danger/40 bg-state-danger/10 px-3 py-1 text-xs font-medium text-state-danger">
          Unexpected error
        </span>

        <h1 className="font-display text-2xl font-semibold text-content-primary">
          This page hit a snag
        </h1>

        <p className="text-sm text-content-secondary">
          {error.message || 'A component failed while rendering.'} The rest of CodeHub is still
          running, so you can head back and keep going.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button icon={RotateCcw} onClick={this.reset}>
            Try again
          </Button>
          <Button variant="secondary" as="a" href="/">
            Back to home
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
