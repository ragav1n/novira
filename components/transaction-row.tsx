'use client';

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseISO } from 'date-fns';
import { useFormattedDate } from '@/utils/format-date';
import { History, MoreVertical, Users, RefreshCcw, Ban, MapPin, Pencil, Trash2, Globe, ArrowLeftRight, Cloud, AlertTriangle, StickyNote, Paperclip, Check } from 'lucide-react';
import type { Transaction } from '@/types/transaction';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, animate, useReducedMotion } from 'framer-motion';
import { ROW, rowVariants } from '@/lib/motion';
import { getCategoryLabel, getIconForCategory } from '@/lib/categories';

interface TransactionRowProps {
  tx: Transaction;
  userId: string | null;
  myShare: number;
  formattedAmount: string;
  formattedConverted?: string;
  showConverted: boolean;
  canEdit: boolean;
  color?: string;
  /**
   * Render props, not rendered nodes — and callbacks that take the transaction
   * rather than closing over it.
   *
   * This is what makes the `memo` below actually work. Every call site used to
   * pass freshly-built elements (`bucketChip={getBucketChip(tx)}`) and inline
   * arrows (`onEdit={() => …}`), so no two renders ever produced equal props and
   * the memo never hit once: one parent render re-rendered every row, and in bulk
   * mode that meant ticking a single checkbox re-rendered all 300.
   *
   * An element's identity can't be stabilised; a function's can, with
   * `useCallback`. So the row takes the function and calls it itself.
   */
  renderBucketChip?: (tx: Transaction) => React.ReactNode;
  /** Overrides the plain description — search uses it to highlight the match. */
  renderDescription?: (tx: Transaction) => React.ReactNode;
  onHistory: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onViewReceipt?: (tx: Transaction) => void;
  onAttachReceipt?: (tx: Transaction) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (tx: Transaction) => void;
  /** Plays the fade-up entrance on mount. Pass `false` for lists that swap their
   *  whole contents at once — search returns up to SEARCH_RESULT_LIMIT (300) rows, and firing
   *  300 simultaneous entrance tweens on every keystroke is what made results feel
   *  heavy. Bounded lists (dashboard's 5, the paginated main list) leave it on. */
  animateEntrance?: boolean;
  /**
   * Lets the browser skip layout and paint for this row while it's scrolled out of
   * view. Only for long lists.
   *
   * Off by default because `contain-intrinsic-size` has to guess a height, and the
   * guess (64px) is the height of a *plain* row — one carrying tag or bucket chips is
   * taller, so an off-screen row is under-reserved and grows as it scrolls in. That's
   * an acceptable trade for a 300-row list and a pointless risk for a 5-row one.
   */
  deferOffscreen?: boolean;
}

/** Hoisted so the style object identity is stable and can't defeat the memo. */
const OFFSCREEN_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '0 64px',
};

function CategoryIcon({ icon, color }: { icon: React.ReactNode; color: string }) {
  if (!React.isValidElement(icon)) return <>{icon}</>;
  return React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties; className?: string }>, {
    style: { color },
    className: (icon as React.ReactElement<{ className?: string }>).props.className,
  });
}

let _swipeHintLock = false;
const SWIPE_THRESHOLD = 72;  // minimum drag distance to trigger snap
const SWIPE_VELOCITY = 400;  // px/s — a fast flick opens even below the distance threshold
const SNAP_DISTANCE = 130;   // full reveal: 2 × w-16 (64px) buttons + gap
const SNAP_SPRING = { type: 'spring', stiffness: 320, damping: 34, mass: 0.8 } as const;

/**
 * The one row currently swiped open, with its own close function.
 *
 * Only one row can be open at a time, so this used to be coordinated by having
 * *every* row subscribe to a `novira-row-swiped` window event — one listener per
 * row, re-subscribed on every swipe because `swiped` was in the dep array. On an
 * unfiltered search that was hundreds of listeners, and each `openSwipe()`
 * dispatched an event that fanned out to all of them. Holding one entry here
 * turns that fan-out into a single call.
 */
let _openRow: { key: object; close: () => void } | null = null;

/**
 * One IntersectionObserver shared by every row.
 *
 * Each row used to construct its own, unconditionally on mount and regardless of
 * scroll position — hundreds of observers for a job one can do. `rootMargin` is a
 * per-observer setting and identical for all rows, so there is nothing to lose by
 * sharing. Callers get an unsubscribe; a target is dropped as soon as it fires,
 * since `isNear` is one-way.
 */
let _nearObserver: IntersectionObserver | null = null;
const _nearTargets = new Map<Element, () => void>();

function observeNear(el: Element, onNear: () => void): () => void {
    if (typeof IntersectionObserver === 'undefined') { onNear(); return () => {}; }
    if (!_nearObserver) {
        _nearObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const cb = _nearTargets.get(entry.target);
                if (!cb) continue;
                _nearTargets.delete(entry.target);
                _nearObserver?.unobserve(entry.target);
                cb();
            }
        }, { rootMargin: '400px' });
    }
    _nearTargets.set(el, onNear);
    _nearObserver.observe(el);
    return () => {
        _nearTargets.delete(el);
        _nearObserver?.unobserve(el);
    };
}

// Deterministic hue per tag so the same tag always renders in the same color.
// Hash → hue keeps the palette stable across reloads without needing storage.
function hashTag(tag: string): number {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = (hash * 31 + tag.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}
// Memoised: this ran per tag per row per render, and `hashTag` loops over every
// character. The tag vocabulary is tiny and stable, so a plain module cache ends
// the repeated work for the whole session.
const _tagColorCache = new Map<string, { bg: string; border: string; text: string }>();
function tagColors(tag: string): { bg: string; border: string; text: string } {
    const cached = _tagColorCache.get(tag);
    if (cached) return cached;
    const hue = hashTag(tag) % 360;
    const colors = {
        bg: `hsla(${hue}, 80%, 60%, 0.14)`,
        border: `hsla(${hue}, 80%, 60%, 0.32)`,
        text: `hsl(${hue}, 80%, 78%)`,
    };
    _tagColorCache.set(tag, colors);
    return colors;
}

export const TransactionRow = memo(function TransactionRow({
  tx,
  userId,
  myShare,
  formattedAmount,
  formattedConverted,
  showConverted,
  canEdit,
  color = '#8A2BE2',
  renderBucketChip,
  renderDescription,
  onHistory,
  onEdit,
  onDelete,
  onViewReceipt,
  onAttachReceipt,
  selectable = false,
  selected = false,
  onToggleSelect,
  animateEntrance = true,
  deferOffscreen = false,
}: TransactionRowProps) {
  const hasSplits = tx.splits && tx.splits.length > 0;
  const isSettlement = tx.is_settlement;
  const isPending = !!tx._pending;
  const isFailed = !!tx._failed;
  const formatDate = useFormattedDate();
  const router = useRouter();

  const x = useMotionValue(0);
  const [swiped, setSwiped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);

  // Pending/failed rows have a faded card via opacity-70, which lets the swipe
  // action buttons (sitting absolutely behind the card) bleed through. Disable
  // swipe + hide those buttons until the row syncs. Also gate by `isNear` so
  // off-screen rows in long lists don't pay the drag/overlay cost.
  // The `!isSettlement && !hasSplits` terms mirror the dropdown's Edit/Delete gate —
  // otherwise swiping such a row reveals a Delete the menu deliberately hides.
  const swipeEnabled = canEdit && !isSettlement && !hasSplits && !isPending && !isFailed && isNear && !selectable;

  useEffect(() => {
    const el = rowRef.current;
    if (!el || isNear) return;
    return observeNear(el, () => setIsNear(true));
  }, [isNear]);

  useEffect(() => {
    // Gate on `swipeEnabled`, not just `canEdit`: a row that hasn't intersected yet
    // renders no action buttons, so hinting it just slid open onto a blank strip.
    if (prefersReducedMotion || !swipeEnabled || _swipeHintLock) return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('novira-swipe-hint')) return;
    _swipeHintLock = true;
    // Tracks whether *this* effect instance took the lock. The effect re-runs when
    // `swipeEnabled` flips (rows scroll into view), and without this a row that
    // bailed out early would release a lock another row is actively holding —
    // letting two rows play the hint at once.
    const heldLock = true;
    let cancelled = false;
    const run = async () => {
      await new Promise<void>(r => setTimeout(r, 900));
      if (cancelled) return;
      setShowHint(true);
      await animate(x, -SNAP_DISTANCE, { type: 'spring', stiffness: 180, damping: 20 });
      if (cancelled) return;
      await new Promise<void>(r => setTimeout(r, 650));
      if (cancelled) return;
      await animate(x, 0, { type: 'spring', stiffness: 380, damping: 38 });
      if (!cancelled) {
        setShowHint(false);
        // localStorage, not sessionStorage: the hint is a one-time teaching moment,
        // and sessionStorage replayed it in every new tab.
        localStorage.setItem('novira-swipe-hint', '1');
      }
    };
    run();
    return () => {
      cancelled = true;
      // Release the lock only if we took it and never finished (unmounted mid-run in a
      // virtualised list, route change). Leaving it set meant the hint silently never
      // appeared again for the rest of the session.
      if (heldLock && (typeof localStorage === 'undefined' || !localStorage.getItem('novira-swipe-hint'))) {
        _swipeHintLock = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeEnabled, prefersReducedMotion]);

  /**
   * Per-instance identity for the open-row registry.
   *
   * Deliberately NOT `tx.id`: the same transaction can be mounted twice at once.
   * The dashboard renders the top-5 inline list and, while "View all" is open, a
   * full list inside the drawer — so up to 5 ids have two live rows, both
   * swipe-enabled. Keyed by `tx.id`, closing the drawer let the drawer's row
   * deregister the *inline* row's entry, leaving it visually open but untracked;
   * and opening the inline copy of an already-open drawer row was skipped by the
   * `!==` guard, leaving two rows open. An empty object is unique per mount, which
   * is exactly the identity this needs.
   */
  const instanceKey = useRef<object>({});

  // Both stable for the row's lifetime: `x` is a motion value, `setSwiped` is a
  // setter, and the ref object never changes identity.
  const closeSwipe = useCallback(() => {
    animate(x, 0, SNAP_SPRING);
    setSwiped(false);
    // Deregister, so a row closed by tap or drag-back doesn't stay on record as
    // the open one and get closed a second time when the next row opens.
    if (_openRow?.key === instanceKey.current) _openRow = null;
  }, [x]);

  const openSwipe = useCallback(() => {
    // Close whichever row was open before us, so only one swipe stays open.
    if (_openRow && _openRow.key !== instanceKey.current) _openRow.close();
    animate(x, -SNAP_DISTANCE, SNAP_SPRING);
    setSwiped(true);
    _openRow = { key: instanceKey.current, close: closeSwipe };
  }, [x, closeSwipe]);

  // Don't leave a closer pointing at an unmounted row — it would setState on it,
  // and the next row to open would think a gone row was still open.
  useEffect(() => {
    const key = instanceKey.current;
    return () => { if (_openRow?.key === key) _openRow = null; };
  }, []);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (!canEdit) return;
    // Distance OR velocity: a fast short flick is the natural mobile gesture, and
    // checking offset alone made it snap back as though the swipe were broken.
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY) openSwipe();
    else closeSwipe();
  };

  // Resolved once per render: it's both a truthiness gate for the badge row and
  // the badge itself. Building the element here is cheap — the win is that the
  // *prop* is now a stable function, so the memo can skip this render entirely.
  const bucketChip = renderBucketChip ? renderBucketChip(tx) : null;

  const paidByLabel = tx.user_id === userId ? 'You' : (tx.profile?.full_name?.split(' ')[0] ?? 'Other');
  const canBulkSelect = selectable && !isPending && !isFailed;

  return (
    <motion.div
      ref={rowRef}
      variants={rowVariants}
      initial={animateEntrance ? 'hidden' : false}
      animate="visible"
      exit="exit"
      transition={ROW}
      className="relative overflow-hidden rounded-xl mt-1.5 first:mt-0"
      style={deferOffscreen ? OFFSCREEN_STYLE : undefined}
    >
      {/* Swipe action buttons */}
      {swipeEnabled && (
        <div className="absolute inset-y-0 right-0 flex items-stretch gap-px bg-black/10">
          <button
            onClick={() => { closeSwipe(); onEdit(tx); }}
            className="w-16 flex items-center justify-center bg-indigo-500 text-white active:brightness-90 hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
            aria-label="Edit transaction"
          >
            <Pencil className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => { closeSwipe(); onDelete(tx); }}
            className="w-16 flex items-center justify-center bg-rose-500 text-white active:brightness-90 hover:brightness-110 transition-[filter] rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
            aria-label="Delete transaction"
          >
            <Trash2 className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Sliding card */}
      <motion.div
        drag={swipeEnabled ? 'x' : false}
        // Without direction lock, a diagonal thumb-scroll hands its horizontal
        // component to Framer and rows visibly shear sideways during normal scrolling.
        dragDirectionLock
        dragConstraints={{ left: -SNAP_DISTANCE, right: 0 }}
        dragElastic={0.07}
        onDragEnd={handleDragEnd}
        style={{ x, borderLeft: `3px solid ${color}`, touchAction: 'pan-y' }}
        onClick={(e) => {
          if (canBulkSelect && onToggleSelect) {
            e.stopPropagation();
            onToggleSelect(tx);
            return;
          }
          if (swiped) closeSwipe();
        }}
        // In bulk mode the row is the checkbox. Without these it was mouse/touch-only,
        // and the selected state was carried purely by a background tint.
        {...(canBulkSelect && onToggleSelect ? {
          role: 'checkbox' as const,
          'aria-checked': selected,
          'aria-label': `Select ${tx.description}`,
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleSelect(tx);
            }
          },
        } : {})}
        className={cn(
          "relative flex items-center gap-3 px-4 py-3.5 bg-card select-none transition-colors",
          isPending && "opacity-70",
          selectable && !canBulkSelect && "opacity-40",
          canBulkSelect && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
          selected && "bg-primary/10"
        )}
      >
        {/* Bulk-select checkbox */}
        {selectable && (
          <div
            className={cn(
              "shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors",
              selected
                ? "bg-primary border border-primary"
                : "border border-white/20 bg-secondary/20",
              !canBulkSelect && "opacity-50"
            )}
            aria-hidden="true"
          >
            {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
          </div>
        )}
        {/* Icon */}
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}18`, border: `1.5px solid ${color}28` }}
          >
            {/* Derived here rather than passed in: all three call sites built the
                identical `getIconForCategory(tx.category, 'w-4 h-4')` element, and a
                fresh element as a prop is what kept the memo from ever hitting. */}
            <CategoryIcon icon={getIconForCategory(tx.category, 'w-4 h-4')} color={color} />
          </div>
          {hasSplits && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Users className="w-2 h-2 text-white" />
            </div>
          )}
        </div>

        {/* Content — flex-1 with overflow guard */}
        <div className="flex-1 min-w-0 overflow-hidden">

          {/* Row 1: description + amount */}
          <div className="flex items-baseline gap-2">
            <p className="flex-1 min-w-0 truncate text-body font-semibold text-white/90 leading-none">
              {renderDescription ? renderDescription(tx) : tx.description}
            </p>
            <div className="shrink-0 text-right leading-none">
              <span className={cn(
                'text-sm font-bold tabular-nums',
                myShare < 0 ? 'text-emerald-400' : 'text-white/85'
              )}>
                {myShare < 0 ? '+' : '−'}{formattedAmount}
              </span>
              {showConverted && formattedConverted && (
                <p className="text-caption font-bold tabular-nums mt-0.5 px-1 py-[1px] rounded bg-primary/15 text-primary/80">
                  ≈ {formattedConverted}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: meta tags + dropdown */}
          <div className="flex items-center justify-between gap-1 mt-1.5">
            {/* Left meta — all shrink-0, no wrap */}
            <div className="flex items-center gap-1 overflow-hidden">
              <span
                className="shrink-0 text-caption font-bold px-1.5 py-[2px] rounded capitalize leading-none"
                style={{ backgroundColor: `${color}18`, color }}
              >
                {isSettlement ? 'Settlement' : getCategoryLabel(tx.category)}
              </span>
              <span className="shrink-0 text-white/20 text-caption">·</span>
              <span className="shrink-0 text-meta text-white/35 font-medium leading-none">{paidByLabel}</span>
              <span className="shrink-0 text-white/20 text-caption">·</span>
              <span className="shrink-0 text-meta text-white/35 font-medium tabular-nums leading-none">
                {formatDate(parseISO(tx.date.slice(0, 10)), 'short')}
              </span>
              {/* Location indicator */}
              {tx.place_name && (
                tx.place_name === 'Online'
                  ? <Globe role="img" className="shrink-0 w-3 h-3 text-blue-400/60 ml-0.5" aria-label="Online purchase" />
                  : <MapPin role="img" className="shrink-0 w-3 h-3 text-emerald-400/50 ml-0.5" aria-label="Has location" />
              )}
              {/* Receipt indicator — tap to open viewer */}
              {tx.receipt_path && onViewReceipt && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onViewReceipt(tx); }}
                  className="shrink-0 ml-0.5 p-2 -m-1.5 rounded text-sky-300/70 hover:text-sky-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                  aria-label="View attached receipt"
                >
                  <Paperclip className="w-3 h-3" />
                </button>
              )}
              {/* Note indicator — tap to reveal */}
              {tx.notes && tx.notes.trim() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 ml-0.5 p-2 -m-1.5 rounded text-amber-300/70 hover:text-amber-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                      aria-label="Show note"
                    >
                      <StickyNote className="w-3 h-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    className="max-w-[280px] p-3 bg-card/95 backdrop-blur-xl border-white/10 text-xs leading-relaxed text-white/85 whitespace-pre-wrap break-words"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tx.notes}
                  </PopoverContent>
                </Popover>
              )}
              {isPending && (
                <span className="shrink-0 flex items-center gap-1 px-1.5 py-[2px] rounded bg-sky-500/10 text-sky-400 border border-sky-500/15 text-caption font-medium ml-1" aria-label="Waiting to sync">
                  <Cloud className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                  Syncing
                </span>
              )}
              {isFailed && (
                <span className="shrink-0 flex items-center gap-1 px-1.5 py-[2px] rounded bg-rose-500/10 text-rose-400 border border-rose-500/15 text-caption font-medium ml-1" title={tx._syncError || undefined} aria-label="Sync failed">
                  <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
                  Failed
                </span>
              )}
              {tx.tags && tx.tags.length > 0 && (
                <span className="shrink-0 flex items-center gap-1 ml-0.5" aria-label={`Tags: ${tx.tags.join(', ')}`}>
                  <span className="text-white/20 text-caption">·</span>
                  {tx.tags.slice(0, 2).map(t => {
                    const c = tagColors(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/search?tag=${encodeURIComponent(t)}`);
                          window.dispatchEvent(new CustomEvent('novira:apply-tag-filter', { detail: { tag: t } }));
                        }}
                        className="shrink-0 text-caption font-bold leading-none px-1.5 py-[2px] rounded border tabular-nums hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                        aria-label={`Filter by tag ${t}`}
                      >
                        #{t}
                      </button>
                    );
                  })}
                  {tx.tags.length > 2 && (
                    <span className="shrink-0 text-caption text-white/40 font-semibold">+{tx.tags.length - 2}</span>
                  )}
                </span>
              )}
            </div>

            {/* Right: dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="shrink-0 flex items-center justify-center min-h-[36px] min-w-[36px] -my-2 rounded-full hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onClick={(e) => e.stopPropagation()}
                aria-label="Transaction options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card/98 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl min-w-[140px]">
                <DropdownMenuItem
                  delayDuration={0}
                  onClick={(e) => { e.stopPropagation(); onHistory(tx); }}
                  className="rounded-lg cursor-pointer gap-2 text-body"
                >
                  <History className="w-3.5 h-3.5" />
                  History
                </DropdownMenuItem>
                {tx.receipt_path && onViewReceipt && (
                  <DropdownMenuItem
                    delayDuration={0}
                    onClick={(e) => { e.stopPropagation(); onViewReceipt(tx); }}
                    className="rounded-lg cursor-pointer gap-2 text-body"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    View receipt
                  </DropdownMenuItem>
                )}
                {canEdit && onAttachReceipt && (
                  <DropdownMenuItem
                    delayDuration={0}
                    onClick={(e) => { e.stopPropagation(); onAttachReceipt(tx); }}
                    className="rounded-lg cursor-pointer gap-2 text-body"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {tx.receipt_path ? 'Replace receipt' : 'Attach receipt'}
                  </DropdownMenuItem>
                )}
                {/* Kept as sibling conditionals rather than wrapped in a
                    fragment: DropdownMenuContent clones every child to inject a
                    `--m3-stagger` style, and cloning a Fragment with `style` logs
                    "Invalid prop `style` supplied to React.Fragment" on every open. */}
                {canEdit && !isSettlement && !hasSplits && (
                  <DropdownMenuItem
                    delayDuration={0}
                    onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
                    className="rounded-lg cursor-pointer gap-2 text-body"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canEdit && !isSettlement && !hasSplits && (
                  <DropdownMenuItem
                    delayDuration={0}
                    onClick={(e) => { e.stopPropagation(); onDelete(tx); }}
                    className="rounded-lg cursor-pointer text-destructive focus:text-destructive gap-2 text-body"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 3: badges */}
          {(bucketChip || tx.is_recurring || tx.exclude_from_allowance || isSettlement) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {bucketChip}
              {isSettlement && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-emerald-500/10 text-caption text-emerald-400 border border-emerald-500/10 font-medium shrink-0">
                  <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                  Settlement
                </span>
              )}
              {tx.is_recurring && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-cyan-500/10 text-caption text-cyan-400 border border-cyan-500/10 font-medium shrink-0">
                  <RefreshCcw className="w-2.5 h-2.5 shrink-0" />
                  Recurring
                </span>
              )}
              {tx.exclude_from_allowance && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-rose-500/10 text-caption text-rose-400 border border-rose-500/10 font-medium shrink-0">
                  <Ban className="w-2.5 h-2.5 shrink-0" />
                  Excluded
                </span>
              )}
            </div>
          )}
        </div>

        {/* Swipe hint */}
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-2 right-10 flex items-center gap-0.5 text-micro text-white/25 font-medium pointer-events-none select-none"
          >
            swipe
            <svg width="10" height="7" viewBox="0 0 10 7" fill="none" aria-hidden="true">
              <path d="M1 3.5h8M5.5 1l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
});
