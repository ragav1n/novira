'use client';

import { motion } from 'framer-motion';

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
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex-1 flex flex-col w-full h-full"
    >
      {children}
    </motion.div>
  );
}
