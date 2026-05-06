'use client';

import { useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Always-visible "copy link to this section" button. Touch-friendly — no
 * hover-only reveal. Shows a brief checkmark when copied.
 */
export function SectionLinkButton({ sectionId, title }: { sectionId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
    history.replaceState(null, '', `#${sectionId}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard write can fail on some browsers; the URL is still updated
      // via replaceState above so the user can copy from the address bar.
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `Link to ${title} copied` : `Copy link to ${title}`}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-foreground/75 transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
        copied && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
    </button>
  );
}
