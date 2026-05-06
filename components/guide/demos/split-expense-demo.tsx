'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Pizza, Users } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SLIDE, SNAPPY, FADE, STAGGER_NORMAL } from './transitions';

export function SplitExpenseDemo() {
  return (
    <AutoPlay ariaLabel="A 90 dollar expense splitting evenly into three 30 dollar shares across three avatars">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const PEOPLE = [
  { name: 'You',  initial: 'Y', tone: 'from-primary to-fuchsia-500' },
  { name: 'Maya', initial: 'M', tone: 'from-rose-400 to-rose-600' },
  { name: 'Arjun',initial: 'A', tone: 'from-sky-400 to-sky-600' },
];

function Inner({ play }: { play: boolean }) {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setPhase(0);
      timeouts.push(setTimeout(() => !cancelled && setPhase(1), 1200));
      timeouts.push(setTimeout(() => !cancelled && setPhase(2), 2400));
      timeouts.push(setTimeout(loop, 5200));
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
            <Pizza className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Pizza Friday</div>
            <div className="text-[11px] text-muted-foreground">Food · Tonight</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Total</div>
            <div className="font-mono text-sm font-semibold text-foreground">₹90.00</div>
          </div>
        </div>

        {/* Fixed height keeps the demo card stable across phases — avatars (~48px)
            plus reserved space for the ₹30 badges that appear in phase 2. */}
        <div className="mt-5 flex h-[88px] items-start justify-center gap-3">
          {PEOPLE.map((p, i) => {
            const isShown = phase >= 1;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0.5, x: -36 * (i - 1) }}
                animate={isShown ? { opacity: 1, x: 0 } : { opacity: 0.5, x: -36 * (i - 1) }}
                transition={{ ...SLIDE, delay: isShown ? i * STAGGER_NORMAL : 0 }}
                style={{ willChange: 'transform, opacity' }}
                className="flex flex-col items-center transform-gpu"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${p.tone} text-sm font-bold text-white shadow-md`}>
                  {p.initial}
                </div>
                <AnimatePresence>
                  {phase >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ ...SNAPPY, delay: i * STAGGER_NORMAL }}
                      className="mt-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300 transform-gpu"
                      style={{ willChange: 'transform, opacity' }}
                    >
                      ₹30.00
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-5 flex h-4 items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={FADE}
            >
              {phase < 1 && 'Single expense'}
              {phase === 1 && 'Splitting evenly…'}
              {phase >= 2 && 'Each owes ₹30 — settle anytime'}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
