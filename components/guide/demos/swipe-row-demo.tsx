'use client';

import { motion, useAnimate } from 'framer-motion';
import { useEffect } from 'react';
import { Coffee, Pencil, Trash2 } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { GLIDE } from './transitions';

export function SwipeRowDemo() {
  return (
    <AutoPlay ariaLabel="A transaction row swiping left to reveal Edit and Delete buttons">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

function Inner({ play }: { play: boolean }) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    let mounted = true;
    if (!play) return;

    async function loop() {
      while (mounted) {
        // Guard: bail if the row has unmounted mid-loop. Passing null to
        // framer-motion's animate() makes its internal WeakMap throw.
        if (!scope.current) break;
        try {
          await animate(scope.current, { x: 0 }, { duration: 0.001 });
          if (!mounted || !scope.current) break;
          await new Promise((r) => setTimeout(r, 800));
          if (!mounted || !scope.current) break;
          await animate(scope.current, { x: -128 }, GLIDE);
          if (!mounted || !scope.current) break;
          await new Promise((r) => setTimeout(r, 1500));
          if (!mounted || !scope.current) break;
          await animate(scope.current, { x: 0 }, GLIDE);
          if (!mounted) break;
          await new Promise((r) => setTimeout(r, 1900));
        } catch {
          break;
        }
      }
    }
    loop();
    return () => {
      mounted = false;
    };
  }, [play, animate, scope]);

  return (
    <div className="mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
        {/* Action layer (revealed on swipe) */}
        <div className="absolute inset-0 flex items-stretch justify-end">
          <div className="flex w-16 items-center justify-center bg-indigo-500/85 text-white">
            <Pencil className="h-4 w-4" />
          </div>
          <div className="flex w-16 items-center justify-center bg-red-500/90 text-white">
            <Trash2 className="h-4 w-4" />
          </div>
        </div>

        {/* Foreground row */}
        <motion.div
          ref={scope}
          style={{ willChange: 'transform' }}
          className="relative z-10 flex items-center gap-3 bg-zinc-950 px-4 py-3.5 transform-gpu"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Coffee className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">Blue Tokai</div>
            <div className="text-[11px] text-foreground/75">Food · Today</div>
          </div>
          <div className="text-sm font-semibold text-foreground">−₹380</div>
        </motion.div>
      </div>
      <p className="mt-3 text-center text-xs text-foreground/75">
        Swipe a transaction left to reveal <span className="text-foreground/90">Edit</span> and{' '}
        <span className="text-foreground/90">Delete</span>.
      </p>
    </div>
  );
}
