'use client';

import { motion } from 'framer-motion';
import { EASE_OUT_SOFT } from '@/lib/motion';

/**
 * Per-page entrance transition. Adds the soft scale + blur effect that the
 * root `app/template.tsx` used to apply globally — but now opt-in only, so
 * public marketing pages (privacy, terms, guide) can keep their fixed
 * MarketingBackground intact (the wrapper's `transform`/`filter` would
 * otherwise become a containing block for `position: fixed` descendants).
 *
 * Wrap a page's main content with this:
 *   <PageTransition>
 *     <MyView />
 *   </PageTransition>
 *
 * Only the entrance is animated here — the exit cross-fade is handled by the
 * root template's opacity-only motion wrapper (which doesn't create a
 * containing block, so it's safe everywhere).
 *
 * Deliberately opacity + scale only. This used to also animate
 * `filter: blur(4px) -> blur(0px)`, which meant every navigation blurred the
 * *entire incoming page tree* for 300ms while the outgoing tree was still
 * mounted (mobile-layout's AnimatePresence runs in sync mode). At a 300ms fade
 * from opacity 0 the blur was near-imperceptible but cost a full-page
 * composited layer on the hottest path in the app.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE_OUT_SOFT }}
      className="flex-1 flex flex-col w-full h-full"
    >
      {children}
    </motion.div>
  );
}
