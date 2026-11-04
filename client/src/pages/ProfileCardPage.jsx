import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, Download, EyeOff, Link2, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublicProfile } from '../api/public.api.js';
import { PageTransition } from '../components/common/Motion.jsx';
import { SAMPLE_PUBLIC_PROFILE } from '../components/landing/sampleProfile.js';
import ProfileCard from '../components/share/ProfileCard.jsx';
import Button from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Portrait profile card on its own page: /u/:username/card for real public
 * profiles and /example/card for the landing page's sample data.
 */
const CardView = ({ data, example }) => {
  const toast = useToast();
  const cardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { owner, handles = {}, combined = {} } = data;
  const profilePath = example ? '/example' : `/u/${owner.username}`;
  const cardUrl = `${window.location.origin}${profilePath}/card`;

  const download = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const link = document.createElement('a');
      link.download = `codehub-card-${owner.username}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Card downloaded');
    } catch (error) {
      console.error('html-to-image failed', error);
      toast.error('Could not render the card', 'Try again, or take a screenshot instead.');
    } finally {
      setIsExporting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      toast.success('Link copied', cardUrl);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h1 className="sr-only">
        {owner.displayName}&apos;s CodeHub card{example ? ' (example)' : ''}
      </h1>
      {example ? (
        <p className="mb-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-edge bg-surface-raised px-4 py-1.5 text-center text-xs text-content-secondary shadow-card">
          <Sparkles size={13} className="text-brand-300" aria-hidden="true" />
          Example card with made-up numbers.
          <Link to="/register" className="text-link">
            Make yours
          </Link>
        </p>
      ) : null}

      <ProfileCard
        ref={cardRef}
        displayName={owner.displayName}
        username={owner.username}
        totalSolved={combined.totalSolved ?? 0}
        activeDays={combined.streaks?.activeDays ?? 0}
        handles={handles}
        topics={combined.topTopics ?? []}
      />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button as={Link} to={profilePath} variant="secondary" size="sm" iconRight={ArrowUpRight}>
          View profile
        </Button>
        <Button size="sm" icon={Download} loading={isExporting} onClick={download}>
          Download PNG
        </Button>
        {example ? null : (
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? Check : Link2}
            onClick={copyLink}
            className={copied ? 'text-state-success' : undefined}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        )}
      </div>
    </div>
  );
};

const RealCard = () => {
  const { username } = useParams();
  // Same query key as the public profile page, so moving between them is instant.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => fetchPublicProfile(username),
    retry: false,
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center" role="status" aria-label="Loading card">
        <Skeleton className="h-[30rem] w-80 rounded-[1.75rem]" />
      </div>
    );
  }
  if (error) {
    const isPrivate = error.code === 'PROFILE_NOT_PUBLIC' || error.status === 404;
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="sr-only">{isPrivate ? 'Card unavailable' : 'Card could not load'}</h1>
        {isPrivate ? (
          <EmptyState
            icon={EyeOff}
            title="This card is private"
            description={`Either @${username} does not exist, or they have not turned on public sharing.`}
            action={
              <Button as={Link} to="/" size="sm">
                Back to CodeHub
              </Button>
            }
          />
        ) : (
          <ErrorState title="Could not load this card" error={error} onRetry={refetch} />
        )}
      </div>
    );
  }
  return <CardView data={data} />;
};

export const ProfileCardPage = ({ example = false }) => (
  <PageTransition>
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {example ? <CardView data={SAMPLE_PUBLIC_PROFILE} example /> : <RealCard />}
    </section>
  </PageTransition>
);

export default ProfileCardPage;
