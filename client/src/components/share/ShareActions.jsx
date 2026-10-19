import { Check, Download, Image, Link2, MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { cardImageUrl } from '../../api/public.api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Button from '../ui/Button.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { LinkedInGlyph, XGlyph } from './BrandGlyphs.jsx';

/**
 * Share row for a public profile.
 *
 * The PNG download happens in the browser via html-to-image (imported lazily so
 * it never lands in the main bundle). The server-rendered PNG is still used for
 * link previews, and is offered here as a fallback if canvas capture fails.
 */
export const ShareActions = ({ username, cardRef, displayName, summary }) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const profileUrl = `${window.location.origin}/u/${username}`;
  const shareText = `${displayName} on CodeHub — ${summary ?? 'unified competitive programming dashboard'}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Link copied', profileUrl);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.');
    }
  };

  const downloadPng = async () => {
    if (!cardRef?.current) return;

    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        // The card paints its own background; this avoids transparent corners.
        backgroundColor: undefined,
      });

      const link = document.createElement('a');
      link.download = `codehub-${username}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Card downloaded');
    } catch (error) {
      toast.error(
        'Could not render the card here',
        'Opening the server-rendered image instead.',
      );
      window.open(cardImageUrl(username), '_blank', 'noopener');
      console.error('html-to-image failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  const shareTargets = [
    {
      label: 'LinkedIn',
      icon: LinkedInGlyph,
      // LinkedIn's crawler fetches /u/:username; vercel.json (or Express, on a
      // single-service deploy) hands crawlers the meta-tagged /share/:username.
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
    },
    {
      label: 'X',
      icon: XGlyph,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`,
    },
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${profileUrl}`)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={copied ? Check : Link2}
        onClick={copyLink}
        className={copied ? 'text-state-success' : undefined}
      >
        {copied ? 'Copied' : 'Copy link'}
      </Button>

      <Button size="sm" icon={Download} loading={isExporting} onClick={downloadPng}>
        Download PNG
      </Button>

      <Tooltip content="Open the server-rendered image (what social previews use)">
        <Button
          as="a"
          href={cardImageUrl(username)}
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          size="icon"
          aria-label="Open server-rendered card image"
        >
          <Image size={15} />
        </Button>
      </Tooltip>

      <span className="mx-1 hidden h-6 w-px bg-edge sm:block" aria-hidden="true" />

      {shareTargets.map((target) => (
        <Tooltip key={target.label} content={`Share on ${target.label}`}>
          <Button
            as="a"
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="icon"
            aria-label={`Share on ${target.label}`}
          >
            <target.icon size={15} />
          </Button>
        </Tooltip>
      ))}
    </div>
  );
};

export default ShareActions;
