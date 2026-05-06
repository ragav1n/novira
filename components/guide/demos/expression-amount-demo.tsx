'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SNAPPY, FADE } from './transitions';

export function ExpressionAmountDemo() {
  return (
    <AutoPlay ariaLabel="Amount input typing 12.5 plus 3.20 and resolving to 15.70">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const SCRIPT = '12.5+3.20';
const RESOLVED = '15.70';
const TYPE_DELAY = 95; // ms per character — feels brisk but readable

function Inner({ play }: { play: boolean }) {
  const [text, setText] = useState('');
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setText('');
      setResolved(false);

      SCRIPT.split('').forEach((_, i) => {
        timeouts.push(
          setTimeout(() => {
            if (!cancelled) setText(SCRIPT.slice(0, i + 1));
          }, 220 + i * TYPE_DELAY)
        );
      });

      const resolveAt = 220 + SCRIPT.length * TYPE_DELAY + 650;
      timeouts.push(
        setTimeout(() => {
          if (!cancelled) setResolved(true);
        }, resolveAt)
      );

      timeouts.push(setTimeout(loop, resolveAt + 2600));
    }
    loop();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Amount</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-medium text-muted-foreground">₹</span>
          <div className="relative flex-1 font-mono text-3xl font-semibold tracking-tight text-foreground">
            <AnimatePresence mode="wait" initial={false}>
              {resolved ? (
                <motion.span
                  key="resolved"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={FADE}
                  className="block text-emerald-300 transform-gpu"
                  style={{ willChange: 'transform, opacity' }}
                >
                  {RESOLVED}
                </motion.span>
              ) : (
                <motion.span
                  key="typing"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={FADE}
                  className="block transform-gpu"
                >
                  {text}
                  <motion.span
                    aria-hidden
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
                    className="ml-0.5 inline-block h-7 w-[2px] -translate-y-1 bg-primary align-middle"
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {resolved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={SNAPPY}
                className="inline-flex items-center gap-1 transform-gpu rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                style={{ willChange: 'transform, opacity' }}
              >
                <Calculator className="h-3 w-3" />
                Press Enter
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          Type a math expression with <code className="rounded bg-white/5 px-1 text-[11px]">+</code>{' '}
          <code className="rounded bg-white/5 px-1 text-[11px]">-</code>{' '}
          <code className="rounded bg-white/5 px-1 text-[11px]">×</code>{' '}
          <code className="rounded bg-white/5 px-1 text-[11px]">÷</code> — Novira shows the result and applies it when you tap away or press Enter.
        </div>
      </div>
    </div>
  );
}
