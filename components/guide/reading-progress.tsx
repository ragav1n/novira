'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Thin gradient line at the top of the page that fills as you scroll through
 * the guide. Reads scroll from <main id="main-content"> (Novira's actual
 * scroll container — window scroll never fires).
 */
export function ReadingProgress() {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 220, damping: 32, mass: 0.5 });

  useEffect(() => {
    const el = document.getElementById('main-content') as HTMLElement | null;
    if (!el) return;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      raw.set(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [raw]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" aria-hidden>
      <motion.div
        className="h-full origin-left bg-gradient-to-r from-primary via-fuchsia-400 to-primary shadow-[0_0_12px_rgba(138,43,226,0.5)]"
        style={{ scaleX: smooth }}
      />
    </div>
  );
}
