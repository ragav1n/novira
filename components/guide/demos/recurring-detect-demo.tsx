'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Music, Repeat } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SOFT, FADE } from './transitions';

export function RecurringDetectDemo() {
  return (
    <AutoPlay ariaLabel="Four similar Spotify transactions appearing one by one, then collapsing into a single detected recurring template">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const TXNS = [
  { date: 'Jan 04', amount: 199 },
  { date: 'Feb 04', amount: 199 },
  { date: 'Mar 04', amount: 199 },
  { date: 'Apr 04', amount: 199 },
];

function Inner({ play }: { play: boolean }) {
  const [shown, setShown] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setShown(0);
      setCollapsed(false);
      TXNS.forEach((_, i) => {
        timeouts.push(setTimeout(() => !cancelled && setShown(i + 1), 500 + i * 450));
      });
      timeouts.push(setTimeout(() => !cancelled && setCollapsed(true), 500 + TXNS.length * 450 + 700));
      timeouts.push(setTimeout(loop, 500 + TXNS.length * 450 + 700 + 2400));
    }
    loop();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
        <div className="text-[10px] uppercase tracking-widest text-foreground/65">Last 90 days</div>

        {/* Fixed height fits the worst case (4 transactions stacked) so the
            section content below never shifts while the demo cycles. */}
        <div className="relative mt-3 h-[224px]">
          <AnimatePresence initial={false}>
            {!collapsed &&
              TXNS.slice(0, shown).map((t, i) => (
                <motion.div
                  key={t.date}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -i * 8, transition: { ...FADE, duration: 0.5 } }}
                  transition={FADE}
                  style={{ willChange: 'transform, opacity' }}
                  className="mb-2 flex items-center gap-3 transform-gpu rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                    <Music className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-[13px] text-foreground/90">Spotify Premium</div>
                  <div className="text-[11px] text-foreground/75">{t.date}</div>
                  <div className="font-mono text-[12px] text-foreground">−₹{t.amount}</div>
                </motion.div>
              ))}
          </AnimatePresence>

          <AnimatePresence>
            {collapsed && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={SOFT}
                style={{ willChange: 'transform, opacity' }}
                className="absolute inset-x-0 top-0 transform-gpu rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Repeat className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">Spotify Premium</div>
                    <div className="text-[11px] text-emerald-300">Monthly · ₹199 · Detected</div>
                  </div>
                  <button className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                    Track
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-foreground/75">
                  Spotted 4 similar charges on a steady monthly rhythm. Tap Track to start tracking it as recurring.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
