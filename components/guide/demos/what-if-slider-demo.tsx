'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Coffee, Sparkles, Target } from 'lucide-react';
import { SNAPPY, QUICK_FADE } from './transitions';

const BASE_DINING = 8400; // monthly spend
const GOAL_TARGET = 60000;
const GOAL_SAVED = 12000;

export function WhatIfSliderDemo() {
  const [pct, setPct] = useState(20);

  const monthlySavings = Math.round((BASE_DINING * pct) / 100);
  const yearly = monthlySavings * 12;
  const remainingForGoal = GOAL_TARGET - GOAL_SAVED;
  const monthsToGoal = monthlySavings > 0 ? Math.ceil(remainingForGoal / monthlySavings) : Infinity;

  return (
    <div
      role="region"
      aria-label="Interactive what-if simulator: drag to see what cutting Dining by a percentage would save"
      className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/[0.05] via-primary/[0.05] to-transparent p-5"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-fuchsia-300">
        <Sparkles className="h-3 w-3" />
        Try the what-if simulator
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
          <Coffee className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Cut Dining by</div>
          <div className="text-[11px] text-foreground/75">Currently ₹{BASE_DINING.toLocaleString('en-IN')}/mo</div>
        </div>
        <motion.div
          key={pct}
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          transition={SNAPPY}
          className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 font-mono text-sm font-semibold text-fuchsia-300 transform-gpu"
        >
          {pct}%
        </motion.div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="mt-4 w-full accent-fuchsia-400"
        aria-label="Percentage to cut"
      />

      <div className="mt-5 grid grid-cols-2 gap-2.5 text-[12px]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-foreground/65">Monthly</div>
          <motion.div
            key={monthlySavings}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={QUICK_FADE}
            className="mt-0.5 font-mono text-base font-semibold text-emerald-300 transform-gpu"
          >
            +₹{monthlySavings.toLocaleString('en-IN')}
          </motion.div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-foreground/65">In 12 months</div>
          <motion.div
            key={yearly}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={QUICK_FADE}
            className="mt-0.5 font-mono text-base font-semibold text-emerald-300 transform-gpu"
          >
            +₹{yearly.toLocaleString('en-IN')}
          </motion.div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] px-3 py-2.5">
        <Target className="h-4 w-4 shrink-0 text-emerald-300" />
        <div className="min-w-0 flex-1 text-[12px] text-foreground">
          <div className="font-medium">Emergency fund</div>
          {Number.isFinite(monthsToGoal) ? (
            <div className="text-foreground/75">
              You’d reach it{' '}
              <span className="text-emerald-300">in {monthsToGoal} {monthsToGoal === 1 ? 'month' : 'months'}</span>
            </div>
          ) : (
            <div className="text-foreground/75">Move the slider to see impact</div>
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-foreground/80">
        Live numbers — drag the slider above. The real simulator inside Novira works the same way.
      </p>
    </div>
  );
}
