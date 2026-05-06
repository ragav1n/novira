'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SNAPPY, FADE, QUICK_FADE } from './transitions';

export function CalendarHeatmapDemo() {
  return (
    <AutoPlay ariaLabel="A monthly calendar heatmap with cells gradually filling in by spending intensity, marking the tightest day">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

// Random-looking but deterministic spending intensity per day (0–4).
const INTENSITY = [
  0, 1, 2, 1, 0, 3, 4,
  1, 2, 0, 1, 1, 0, 2,
  2, 3, 4, 2, 1, 0, 0,
  1, 4, 3, 2, 1, 2, 1,
  0, 2, 3,
];

const TIGHTEST_DAY_INDEX = 22; // day 23

function Inner({ play }: { play: boolean }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setShown(0);
      INTENSITY.forEach((_, i) => {
        timeouts.push(setTimeout(() => !cancelled && setShown(i + 1), 200 + i * 28));
      });
      timeouts.push(setTimeout(loop, 200 + INTENSITY.length * 28 + 2600));
    }
    loop();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  const tone = (n: number) => {
    if (n === 0) return 'bg-white/[0.03]';
    if (n === 1) return 'bg-primary/[0.18]';
    if (n === 2) return 'bg-primary/[0.32]';
    if (n === 3) return 'bg-primary/[0.55]';
    return 'bg-primary/[0.85]';
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-foreground/65">April</div>
            <div className="text-sm font-semibold text-foreground">Spending heatmap</div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-foreground/75">
            <span>less</span>
            {[0, 1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-2 w-2 rounded-sm ${tone(n)}`} />
            ))}
            <span>more</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {INTENSITY.map((n, i) => {
            const isShown = i < shown;
            const isTightest = i === TIGHTEST_DAY_INDEX;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={isShown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
                transition={QUICK_FADE}
                style={{ willChange: 'transform, opacity' }}
                className={`relative aspect-square transform-gpu rounded-md ${tone(n)}`}
              >
                {isTightest && isShown && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...SNAPPY, delay: 0.18 }}
                    className="absolute inset-0 transform-gpu rounded-md ring-2 ring-amber-300"
                    style={{ willChange: 'transform, opacity' }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Reserved row so the page below doesn't shift when the callout
            fades in at the end of the loop. */}
        <div className="mt-4 min-h-[58px]">
          <AnimatePresence>
            {shown >= INTENSITY.length && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200 transform-gpu"
                style={{ willChange: 'transform, opacity' }}
              >
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="text-amber-200">Tightest day:</strong> Apr 23 — your balance dipped lowest after rent and groceries hit the same morning.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
