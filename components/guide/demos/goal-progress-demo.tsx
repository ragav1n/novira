'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Plane, Sparkle } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SOFT, SNAPPY, QUICK_FADE } from './transitions';

export function GoalProgressDemo() {
  return (
    <AutoPlay ariaLabel="A savings goal progress bar advancing past 25, 50, and 75 percent milestones">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const MILESTONES = [25, 50, 75, 100];

function Inner({ play }: { play: boolean }) {
  const [progress, setProgress] = useState(0);
  const [pop, setPop] = useState<number | null>(null);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setProgress(0);
      MILESTONES.forEach((m, i) => {
        timeouts.push(
          setTimeout(() => {
            if (cancelled) return;
            setProgress(m);
            setPop(m);
            timeouts.push(setTimeout(() => !cancelled && setPop(null), 900));
          }, 900 + i * 1100)
        );
      });
      timeouts.push(setTimeout(loop, 900 + MILESTONES.length * 1100 + 2800));
    }
    loop();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  return (
    <div className="mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/[0.05] to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Plane className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Iceland trip</div>
            <div className="text-[11px] text-muted-foreground">Goal · ₹{(progress * 1500).toLocaleString('en-IN')} of ₹1,50,000</div>
          </div>
          <motion.div
            key={progress}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={QUICK_FADE}
            className="font-mono text-sm font-semibold text-sky-300 transform-gpu"
          >
            {progress}%
          </motion.div>
        </div>

        <div className="relative mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full origin-left transform-gpu bg-gradient-to-r from-sky-400 to-cyan-300"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ type: 'spring', damping: 24, stiffness: 130, mass: 0.9 }}
            style={{ width: '100%', willChange: 'transform' }}
          />
          {[25, 50, 75].map((m) => (
            <div
              key={m}
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/30"
              style={{ left: `${m}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>

        {/* Reserved row so the milestone popup doesn't push content below
            the demo when it fades in/out. */}
        <div className="mt-4 min-h-[44px]">
          <AnimatePresence>
            {pop !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={SNAPPY}
                style={{ willChange: 'transform, opacity' }}
                className="flex items-center gap-2 transform-gpu rounded-xl border border-sky-400/30 bg-sky-500/[0.08] px-3 py-2.5 text-[12px]"
              >
                <Sparkle className="h-4 w-4 shrink-0 text-sky-300" />
                <span className="text-foreground/90">
                  {pop === 100 ? 'Goal complete.' : `Now at ${pop}%.`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
