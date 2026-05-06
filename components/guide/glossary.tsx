'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, ChevronDown, Box, Users, Split, Repeat, Wallet, Handshake, ArrowRight, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_OUT_SOFT } from './demos/transitions';

type Term = {
  word: string;
  icon: React.ElementType;
  short: string;
  href?: string; // section id within the guide
};

const TERMS: Term[] = [
  { word: 'Bucket',     icon: Box,       short: 'A spending pool with its own budget — for a trip, a project, or a chunk of life that needs separate tracking.',                  href: 'buckets' },
  { word: 'Workspace',  icon: Users,     short: 'A separate space for your money. You always have a Personal one; you can also share with a partner, household, or trip group.', href: 'groups' },
  { word: 'Split',      icon: Split,     short: 'A single expense shared across people — Novira tracks who paid and who owes what.',                                              href: 'splits' },
  { word: 'Recurring',  icon: Repeat,    short: 'An expense or income that repeats on a schedule. Bills, subscriptions, salary.',                                                  href: 'recurring' },
  { word: 'Allowance',  icon: Wallet,    short: 'Your monthly budget for everyday spending. Drives the “Available this month” gauge on the dashboard.',                            href: 'allowance' },
  { word: 'Settlement', icon: Handshake, short: 'The transaction that clears a debt between you and someone else. Created when you mark a balance “settled”.',                     href: 'splits' },
  { word: 'Carryover',  icon: ArrowRight,short: 'Money you didn’t spend last month, calculated and shown to you on the first of this month.',                                       href: 'allowance' },
  { word: 'Trip mode',  icon: Plane,     short: 'A bucket with its own currency — perfect for travel. You log in the local currency, your dashboard shows the home-currency total.', href: 'multi-currency' },
];

export function Glossary() {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label="Glossary of Novira terms"
      className="rounded-3xl border border-white/10 bg-white/[0.015]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-7 sm:py-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-primary/10 text-primary">
            <BookMarked className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/85">
              New here?
            </div>
            <div className="text-base font-semibold text-foreground">Quick glossary</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-[12px] text-muted-foreground sm:block">
            {TERMS.length} terms · click to {open ? 'hide' : 'expand'}
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              height: { duration: 0.42, ease: EASE_OUT_SOFT },
              opacity: { duration: 0.28, ease: EASE_OUT_SOFT, delay: 0.06 },
            }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 border-t border-white/5 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
              {TERMS.map((t) => {
                const Icon = t.icon;
                const inner = (
                  <>
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/85" />
                      <span className="text-[13px] font-semibold text-foreground">{t.word}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {t.short}
                    </p>
                  </>
                );
                return (
                  <a
                    key={t.word}
                    href={t.href ? `#${t.href}` : undefined}
                    className="group block rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
                  >
                    {inner}
                    {t.href && (
                      <div className="mt-2 text-[11px] font-medium text-primary/80 opacity-0 transition-opacity group-hover:opacity-100">
                        Read the full section →
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
