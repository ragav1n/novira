'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Check, CloudOff, Wifi, WifiOff } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SNAPPY, FADE } from './transitions';

export function OfflineQueueDemo() {
  return (
    <AutoPlay ariaLabel="Wifi disconnects, a transaction is queued as pending, then wifi returns and the transaction syncs">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

function Inner({ play }: { play: boolean }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setPhase(0);
      timeouts.push(setTimeout(() => !cancelled && setPhase(1), 1100)); // offline
      timeouts.push(setTimeout(() => !cancelled && setPhase(2), 2700)); // pending tx
      timeouts.push(setTimeout(() => !cancelled && setPhase(3), 4400)); // online + synced
      timeouts.push(setTimeout(loop, 7000));
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
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Adding an expense</div>
          <AnimatePresence mode="wait" initial={false}>
            {phase < 3 && phase >= 1 ? (
              <motion.div
                key="off"
                initial={{ opacity: 0, scale: 0.85, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={SNAPPY}
                style={{ willChange: 'transform, opacity' }}
                className="flex items-center gap-1.5 transform-gpu rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300"
              >
                <WifiOff className="h-3 w-3" />
                Offline
              </motion.div>
            ) : (
              <motion.div
                key="on"
                initial={{ opacity: 0, scale: 0.85, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={SNAPPY}
                style={{ willChange: 'transform, opacity' }}
                className="flex items-center gap-1.5 transform-gpu rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
              >
                <Wifi className="h-3 w-3" />
                Online
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reserved space for the tx card (~80px). Always present so the
            section content below doesn't jump when the card appears in phase 2. */}
        <div className="mt-4 h-[68px]">
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={FADE}
              style={{ willChange: 'transform, opacity' }}
              className="transform-gpu"
            >
              <motion.div
                animate={
                  phase === 2
                    ? { opacity: [0.6, 1, 0.6] }
                    : { opacity: 1 }
                }
                transition={
                  phase === 2
                    ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
                }
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-300 ${
                  phase === 3
                    ? 'border-emerald-400/30 bg-emerald-500/[0.05]'
                    : 'border-amber-400/30 bg-amber-500/[0.05]'
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-300 ${phase === 3 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={phase === 3 ? 'check' : 'cloud'}
                      initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
                      transition={SNAPPY}
                    >
                      {phase === 3 ? <Check className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">Lunch — Café Coffee Day</div>
                  <div className={`text-[11px] transition-colors duration-300 ${phase === 3 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {phase === 3 ? 'Synced' : 'Waiting to sync'}
                  </div>
                </div>
                <div className="font-mono text-sm text-foreground">−₹245</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-foreground/75">
          Add transactions on the train, in airplane mode, in a basement. They land on your device and sync the moment your connection comes back.
        </p>
      </div>
    </div>
  );
}
