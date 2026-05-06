'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, Search as SearchIcon, Sparkles } from 'lucide-react';
import { version as APP_VERSION } from '@/package.json';
import { GUIDE_SECTIONS, GUIDE_GROUPS } from './sections-config';

export function GuideHero() {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/[0.08] via-fuchsia-500/[0.04] to-transparent px-6 py-10 sm:px-10 sm:py-14">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 -left-12 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />

      <div className="relative grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        {/* LEFT: copy + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-primary/90">
            <BookOpen className="h-3 w-3" />
            User guide
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Everything Novira can do,
            <span className="block bg-gradient-to-r from-primary via-fuchsia-400 to-primary bg-clip-text text-transparent">
              in one place.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A friendly, complete walkthrough — from your first transaction to splitting a trip, detecting subscriptions, and exporting your bills to your calendar. Skim with the table of contents or read top-to-bottom.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="#getting-started"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              <Compass className="h-4 w-4" />
              Start at the beginning
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-white/[0.08]"
            >
              Open the app
            </Link>
          </div>

          {/* Quick jump pills */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 flex flex-wrap items-center gap-2"
          >
            <div className="mr-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              <SearchIcon className="h-3 w-3" />
              Jump to
            </div>
            {[
              'adding-transactions',
              'splits',
              'recurring',
              'goals',
              'analytics',
              'offline',
              'gestures',
              'troubleshooting',
            ].map((id) => {
              const s = GUIDE_SECTIONS.find((x) => x.id === id);
              if (!s) return null;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  {s.title}
                </a>
              );
            })}
          </motion.div>
        </motion.div>

        {/* RIGHT: visual section preview (lg+) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden lg:block"
          aria-hidden
        >
          <SectionsPreviewCard />
        </motion.div>
      </div>
    </header>
  );
}

function SectionsPreviewCard() {
  // Stats from the real config so this stays in sync.
  const total = GUIDE_SECTIONS.length;
  const groupCount = GUIDE_GROUPS.length;

  return (
    <div className="relative">
      {/* Outer card */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/90 p-5 shadow-[0_30px_60px_-30px_rgba(138,43,226,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
        {/* Header strip */}
        <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">In this guide</div>
              <div className="text-[12px] font-semibold text-foreground">
                {total} sections · {groupCount} groups
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" aria-hidden />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" aria-hidden />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" aria-hidden />
          </div>
        </div>

        {/* Group rows */}
        <div className="grid grid-cols-2 gap-2">
          {GUIDE_GROUPS.map((group, i) => {
            const items = GUIDE_SECTIONS.filter((s) => s.group === group);
            const FirstIcon = items[0]?.icon;
            return (
              <motion.div
                key={group}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary/85">
                  {FirstIcon && <FirstIcon className="h-3 w-3" />}
                  <span className="truncate">{group}</span>
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  {items.length} {items.length === 1 ? 'section' : 'sections'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-[11px]">
          <span className="text-foreground/85">Animated demos throughout</span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">v{APP_VERSION}</span>
        </div>
      </div>

      {/* Soft accent ring */}
      <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-primary/30 via-transparent to-fuchsia-500/20 blur-md" aria-hidden />
    </div>
  );
}
