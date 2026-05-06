'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { version as APP_VERSION } from '@/package.json';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { GuideHero } from './guide-hero';
import { GuideTocDesktop, GuideTocMobile } from './guide-toc';
import { useIsLargeViewport } from './use-is-large-viewport';
import { ReadingProgress } from './reading-progress';
import { Glossary } from './glossary';
import { SOFT } from './demos/transitions';

// First few sections are above the fold for most readers — load eagerly so the
// page paints fast. Everything else is lazy so we don't ship 19 sections + 11
// demos in the initial bundle.
import { GettingStartedSection } from './sections/getting-started';
import { DashboardSection } from './sections/dashboard';
import { AddingTransactionsSection } from './sections/adding-transactions';

const RecurringSection = dynamic(() => import('./sections/recurring').then(m => ({ default: m.RecurringSection })), { ssr: false });
const SplitsSection = dynamic(() => import('./sections/splits').then(m => ({ default: m.SplitsSection })), { ssr: false });
const MultiCurrencySection = dynamic(() => import('./sections/multi-currency').then(m => ({ default: m.MultiCurrencySection })), { ssr: false });
const BucketsSection = dynamic(() => import('./sections/buckets').then(m => ({ default: m.BucketsSection })), { ssr: false });
const GoalsSection = dynamic(() => import('./sections/goals').then(m => ({ default: m.GoalsSection })), { ssr: false });
const AllowanceSection = dynamic(() => import('./sections/allowance').then(m => ({ default: m.AllowanceSection })), { ssr: false });
const CashflowSection = dynamic(() => import('./sections/cashflow').then(m => ({ default: m.CashflowSection })), { ssr: false });
const AnalyticsSection = dynamic(() => import('./sections/analytics').then(m => ({ default: m.AnalyticsSection })), { ssr: false });
const SearchSection = dynamic(() => import('./sections/search').then(m => ({ default: m.SearchSection })), { ssr: false });
const GroupsSection = dynamic(() => import('./sections/groups').then(m => ({ default: m.GroupsSection })), { ssr: false });
const NotificationsSection = dynamic(() => import('./sections/notifications').then(m => ({ default: m.NotificationsSection })), { ssr: false });
const OfflineSection = dynamic(() => import('./sections/offline').then(m => ({ default: m.OfflineSection })), { ssr: false });
const GesturesSection = dynamic(() => import('./sections/gestures').then(m => ({ default: m.GesturesSection })), { ssr: false });
const DataSection = dynamic(() => import('./sections/data').then(m => ({ default: m.DataSection })), { ssr: false });
const SettingsSection = dynamic(() => import('./sections/settings').then(m => ({ default: m.SettingsSection })), { ssr: false });
const TroubleshootingSection = dynamic(() => import('./sections/troubleshooting').then(m => ({ default: m.TroubleshootingSection })), { ssr: false });

// The Novira root layout puts the page inside <main id="main-content"> which is
// the actual scroll container (overflow-y-auto). Window scroll never fires for
// us, so we look up the main element and listen / scroll there directly.
function getScrollEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (document.getElementById('main-content') as HTMLElement | null) ?? document.scrollingElement as HTMLElement | null;
}

export function GuideLayout() {
  const [showTop, setShowTop] = useState(false);
  const isLarge = useIsLargeViewport();

  useEffect(() => {
    const el = getScrollEl();
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 800);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Hash-link smooth scroll inside the <main> scroller. Browsers' default
  // hash-navigation only handles window scroll — Novira's content scrolls
  // inside <main>, so we intercept anchor clicks within the guide and call
  // scrollIntoView on the target ourselves.
  useEffect(() => {
    const scrollToHash = (hash: string) => {
      if (!hash) return;
      const id = hash.replace(/^#/, '');
      const target = document.getElementById(id);
      if (!target) return;
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    if (window.location.hash) {
      // Lazy sections may not be mounted yet on initial load — give them a tick.
      window.setTimeout(() => scrollToHash(window.location.hash), 80);
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.length < 2 || !href.startsWith('#')) return;
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      history.replaceState(null, '', href);
      scrollToHash(href);
    };

    document.addEventListener('click', onClick);
    const onHash = () => scrollToHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const scrollToTop = () => {
    const el = getScrollEl();
    el?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MotionConfig transition={SOFT} reducedMotion="user">
    {/* z-10 lifts the entire guide above MarketingBackground's multiply-blended
        overlay (z-0/1/2) so text and demos render at full contrast instead of
        getting darkened through it. */}
    <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <ReadingProgress />

      {/* Top bar with back-to-app link */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] text-foreground/80 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Novira
        </Link>
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
          App v{APP_VERSION}
        </div>
      </div>

      <GuideHero />

      <div className="mt-8">
        <Glossary />
      </div>

      <div className="mt-10 flex flex-col gap-10 lg:flex-row">
        {isLarge && <GuideTocDesktop />}

        <main className="min-w-0 flex-1">
          {!isLarge && <GuideTocMobile />}

          <GettingStartedSection />
          <DashboardSection />
          <AddingTransactionsSection />
          <RecurringSection />
          <SplitsSection />
          <MultiCurrencySection />
          <BucketsSection />
          <GoalsSection />
          <AllowanceSection />
          <CashflowSection />
          <AnalyticsSection />
          <SearchSection />
          <GroupsSection />
          <NotificationsSection />
          <OfflineSection />
          <GesturesSection />
          <DataSection />
          <SettingsSection />
          <TroubleshootingSection />

          <footer className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-primary/[0.06] via-fuchsia-500/[0.03] to-transparent p-8 text-center">
            <h3 className="text-xl font-semibold text-foreground">That’s the whole tour.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground/80">
              Novira keeps shipping. Open the app whenever you’re ready — the <strong>?</strong> icon in the dashboard header is your quick way back here.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
              >
                Open Novira
              </Link>
              <a
                href="#getting-started"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-white/[0.08]"
              >
                Back to top
              </a>
            </div>
          </footer>
        </main>
      </div>

      {/* Floating back-to-top button */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            type="button"
            onClick={scrollToTop}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            className="fixed bottom-8 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/80 text-primary shadow-lg backdrop-blur-md transition-colors transform-gpu will-change-transform hover:bg-white/[0.06]"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
