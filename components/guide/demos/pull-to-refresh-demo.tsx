'use client';

import { motion, useAnimate } from 'framer-motion';
import { useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { PhoneFrame } from './phone-frame';
import { SLIDE, EASE_OUT_SOFT } from './transitions';

export function PullToRefreshDemo() {
  return (
    <AutoPlay ariaLabel="Phone screen pulling down to refresh, then snapping back">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

function Inner({ play }: { play: boolean }) {
  const [contentRef, animateContent] = useAnimate();
  const [iconRef, animateIcon] = useAnimate();

  useEffect(() => {
    if (!play) return;
    let mounted = true;

    async function loop() {
      while (mounted) {
        // Bail if either ref unmounted between iterations — passing null to
        // framer-motion's animate() makes its internal WeakMap throw.
        if (!contentRef.current || !iconRef.current) break;
        try {
          // Reset (instant)
          await Promise.all([
            animateContent(contentRef.current, { y: 0 }, { duration: 0.001 }),
            animateIcon(iconRef.current, { opacity: 0, rotate: 0, scale: 0.6 }, { duration: 0.001 }),
          ]);
          if (!mounted || !contentRef.current || !iconRef.current) break;
          await new Promise((r) => setTimeout(r, 800));

          if (!mounted || !contentRef.current || !iconRef.current) break;
          // Pull down — same easing on both so they move as one
          await Promise.all([
            animateContent(contentRef.current, { y: 80 }, { duration: 0.6, ease: EASE_OUT_SOFT }),
            animateIcon(iconRef.current, { opacity: 1, scale: 1, rotate: 270 }, { duration: 0.6, ease: EASE_OUT_SOFT }),
          ]);

          if (!mounted || !iconRef.current) break;
          // Spin (refreshing)
          await animateIcon(iconRef.current, { rotate: 270 + 720 }, { duration: 1.0, ease: 'linear' });

          if (!mounted || !contentRef.current || !iconRef.current) break;
          // Snap back — soft spring on the content, gentle fade on the icon
          await Promise.all([
            animateContent(contentRef.current, { y: 0 }, SLIDE),
            animateIcon(iconRef.current, { opacity: 0, scale: 0.6 }, { duration: 0.32, ease: EASE_OUT_SOFT }),
          ]);

          if (!mounted) break;
          await new Promise((r) => setTimeout(r, 1800));
        } catch {
          // Animation interrupted by unmount — exit cleanly.
          break;
        }
      }
    }
    loop();
    return () => {
      mounted = false;
    };
  }, [play, animateContent, animateIcon, contentRef, iconRef]);

  return (
    <PhoneFrame label="Pull down on the dashboard to refresh">
      <div className="relative h-full overflow-hidden">
        {/* Refresh icon */}
        <motion.div
          ref={iconRef}
          initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
          style={{ willChange: 'transform, opacity' }}
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 transform-gpu rounded-full border border-white/10 bg-card/80 p-2 shadow-lg backdrop-blur-md"
        >
          <RefreshCcw className="h-4 w-4 text-primary" />
        </motion.div>

        {/* Content stack */}
        <motion.div
          ref={contentRef}
          style={{ willChange: 'transform' }}
          className="space-y-3 p-4 transform-gpu"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-primary/20" />
            <div className="space-y-1">
              <div className="h-3 w-24 rounded bg-white/15" />
              <div className="h-2 w-32 rounded bg-white/10" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-widest text-foreground/65">Available this month</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">₹42,180</div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[63%] bg-gradient-to-r from-primary to-fuchsia-400" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-widest text-foreground/65">Recent</div>
            <div className="mt-2 space-y-2">
              {['Zara', 'Uber', 'Blue Tokai'].map((n, i) => (
                <div key={n} className="flex items-center justify-between text-[12px]">
                  <span className="text-foreground">{n}</span>
                  <span className="text-foreground/75">−₹{[2340, 156, 380][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </PhoneFrame>
  );
}
