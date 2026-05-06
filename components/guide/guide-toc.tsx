'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GUIDE_GROUPS, GUIDE_SECTIONS } from './sections-config';
import { motion, AnimatePresence } from 'framer-motion';

function useActiveSection(): string {
  const [active, setActive] = useState<string>(GUIDE_SECTIONS[0]?.id ?? '');

  useEffect(() => {
    // Novira's root layout uses <main id="main-content"> as the scroll
    // container, so IntersectionObserver needs that as its root for the
    // rootMargin trick to behave correctly.
    const root = document.getElementById('main-content');
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { root, rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    );

    GUIDE_SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Hash-link override on initial load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.slice(1);
    if (h && GUIDE_SECTIONS.some((s) => s.id === h)) setActive(h);
  }, []);

  return active;
}

export function GuideTocDesktop() {
  const active = useActiveSection();

  return (
    <nav className="sticky top-24 max-h-[calc(100vh-7rem)] w-[260px] shrink-0 overflow-y-auto pr-2" aria-label="Table of contents">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        On this page
      </div>
      <div className="mt-3 space-y-5">
        {GUIDE_GROUPS.map((group) => (
          <div key={group}>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
              {group}
            </div>
            <ul className="space-y-0.5">
              {GUIDE_SECTIONS.filter((s) => s.group === group).map((s) => {
                const isActive = active === s.id;
                const Icon = s.icon;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground')} />
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function GuideTocMobile() {
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  const activeSection = GUIDE_SECTIONS.find((s) => s.id === active);

  // Close drawer on route change (hash navigation)
  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <div className="sticky top-3 z-30 mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/80 px-4 py-3 text-left backdrop-blur-md transition-colors hover:bg-white/[0.04]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {activeSection && <activeSection.icon className="h-4 w-4 shrink-0 text-primary" />}
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              On this page
            </div>
            <div className="truncate text-sm font-medium text-foreground">
              {activeSection?.title ?? 'Jump to section'}
            </div>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: 'transform, opacity', transformOrigin: 'top center' }}
            className="mt-2 max-h-[60vh] origin-top transform-gpu overflow-y-auto rounded-2xl border border-white/10 bg-background/95 p-2 backdrop-blur-md"
          >
            {GUIDE_GROUPS.map((group) => (
              <div key={group} className="px-1 py-1">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group}
                </div>
                <ul>
                  {GUIDE_SECTIONS.filter((s) => s.group === group).map((s) => {
                    const isActive = active === s.id;
                    const Icon = s.icon;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
                            isActive ? 'bg-primary/10 text-primary' : 'text-foreground/85 hover:bg-white/5'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.title}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
