'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SOFT, FADE, QUICK_FADE } from './transitions';

export function BucketFillDemo() {
  return (
    <AutoPlay ariaLabel="A bucket progress bar filling as transactions stream in">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const TXNS = [
  { name: 'Flights',    amount: 18000 },
  { name: 'Airbnb',     amount: 12500 },
  { name: 'Train pass', amount: 4200 },
  { name: 'Coffee',     amount: 350 },
];

const TOTAL = 50000;

function Inner({ play }: { play: boolean }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setShown(0);
      TXNS.forEach((_, i) => {
        timeouts.push(setTimeout(() => !cancelled && setShown(i + 1), 700 + i * 700));
      });
      timeouts.push(setTimeout(loop, 700 + TXNS.length * 700 + 2200));
    }
    loop();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  const spent = TXNS.slice(0, shown).reduce((s, t) => s + t.amount, 0);
  const pct = Math.min(100, (spent / TOTAL) * 100);

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/[0.05] to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Plane className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Tokyo trip</div>
            <div className="text-[11px] text-muted-foreground">Bucket · Apr 12 → 21</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Spent</div>
            <motion.div
              key={spent}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={QUICK_FADE}
              className="font-mono text-sm font-semibold text-foreground transform-gpu"
            >
              ₹{spent.toLocaleString('en-IN')}
            </motion.div>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full origin-left transform-gpu bg-gradient-to-r from-sky-400 to-cyan-300"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={SOFT}
            style={{ width: '100%', willChange: 'transform' }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{pct.toFixed(0)}% of ₹{TOTAL.toLocaleString('en-IN')}</span>
          <span>{Math.max(0, TOTAL - spent).toLocaleString('en-IN')} left</span>
        </div>

        {/* Fixed-height list area so adding rows doesn't push the page below.
            Sized for 4 rows × ~36px + gaps ≈ 152px. */}
        <div className="mt-4 h-[160px] space-y-1.5">
          <AnimatePresence initial={false}>
            {TXNS.slice(0, shown).map((t) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={FADE}
                style={{ willChange: 'transform, opacity' }}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[12px] transform-gpu"
              >
                <span className="text-foreground/85">{t.name}</span>
                <span className="font-mono text-muted-foreground">−₹{t.amount.toLocaleString('en-IN')}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
