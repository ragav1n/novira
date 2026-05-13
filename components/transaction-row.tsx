'use client';

import React, { memo, useState, useEffect, useRef } from 'react';
import { parseISO } from 'date-fns';
import { useFormattedDate } from '@/utils/format-date';
import { History, MoreVertical, Users, RefreshCcw, Ban, MapPin, Pencil, Trash2, Globe, ArrowLeftRight, Cloud, AlertTriangle, StickyNote, Paperclip } from 'lucide-react';
import type { Transaction } from '@/types/transaction';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, animate, useReducedMotion } from 'framer-motion';
import { getCategoryLabel } from '@/lib/categories';

interface TransactionRowProps {
  tx: Transaction;
  userId: string | null;
  myShare: number;
  formattedAmount: string;
  formattedConverted?: string;
  showConverted: boolean;
  canEdit: boolean;
  icon: React.ReactNode;
  color?: string;
  bucketChip: React.ReactNode | null;
  descriptionNode?: React.ReactNode;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewReceipt?: () => void;
}

function CategoryIcon({ icon, color }: { icon: React.ReactNode; color: string }) {
  if (!React.isValidElement(icon)) return <>{icon}</>;
  return React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties; className?: string }>, {
    style: { color },
    className: (icon as React.ReactElement<{ className?: string }>).props.className,
  });
}

let _swipeHintLock = false;
const SWIPE_THRESHOLD = 72;  // minimum drag distance to trigger snap
const SNAP_DISTANCE = 130;   // full reveal: 2 × w-16 (64px) buttons + gap

export const TransactionRow = memo(function TransactionRow({
  tx,
  userId,
  myShare,
  formattedAmount,
  formattedConverted,
  showConverted,
  canEdit,
  icon,
  color = '#8A2BE2',
  bucketChip,
  descriptionNode,
  onHistory,
  onEdit,
  onDelete,
  onViewReceipt,
}: TransactionRowProps) {
  const hasSplits = tx.splits && tx.splits.length > 0;
  const isSettlement = tx.is_settlement;
  const formatDate = useFormattedDate();

  const x = useMotionValue(0);
  const [swiped, setSwiped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || isNear) return;
    if (typeof IntersectionObserver === 'undefined') { setIsNear(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setIsNear(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [isNear]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!canEdit || tx._pending || tx._failed || _swipeHintLock) return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('novira-swipe-hint')) return;
    _swipeHintLock = true;
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
        sessionStorage.setItem('novira-swipe-hint', '1');
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, prefersReducedMotion]);

  const snapTo = (target: number) => animate(x, target, { type: 'spring', stiffness: 320, damping: 34, mass: 0.8 });

  const openSwipe = () => {
    snapTo(-SNAP_DISTANCE);
    setSwiped(true);
    // Tell sibling rows to close themselves so only one swipe stays open at a time.
    window.dispatchEvent(new CustomEvent('novira-row-swiped', { detail: { id: tx.id } }));
  };

  const closeSwipe = () => { snapTo(0); setSwiped(false); };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (!canEdit) return;
    if (info.offset.x < -SWIPE_THRESHOLD) openSwipe();
    else closeSwipe();
  };

  // When another row opens its swipe panel, close ours.
  useEffect(() => {
    const onOtherSwiped = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail || detail.id === tx.id) return;
      if (swiped) closeSwipe();
    };
    window.addEventListener('novira-row-swiped', onOtherSwiped);
    return () => window.removeEventListener('novira-row-swiped', onOtherSwiped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id, swiped]);

  const paidByLabel = tx.user_id === userId ? 'You' : (tx.profile?.full_name?.split(' ')[0] ?? 'Other');
  const isPending = !!tx._pending;
  const isFailed = !!tx._failed;
  // Pending/failed rows have a faded card via opacity-70, which lets the swipe
  // action buttons (sitting absolutely behind the card) bleed through. Disable
  // swipe + hide those buttons until the row syncs. Also gate by `isNear` so
  // off-screen rows in long lists don't pay the drag/overlay cost.
  const swipeEnabled = canEdit && !isPending && !isFailed && isNear;

  return (
    <motion.div
      ref={rowRef}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl mt-1.5 first:mt-0"
    >
      {/* Swipe action buttons */}
      {swipeEnabled && (
        <div className="absolute inset-y-0 right-0 flex items-stretch gap-px bg-black/10">
          <button
            onClick={() => { closeSwipe(); onEdit(); }}
            className="w-16 flex items-center justify-center bg-indigo-500 text-white active:brightness-90 hover:brightness-110 transition-[filter]"
            aria-label="Edit transaction"
          >
            <Pencil className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => { closeSwipe(); onDelete(); }}
            className="w-16 flex items-center justify-center bg-rose-500 text-white active:brightness-90 hover:brightness-110 transition-[filter] rounded-r-xl"
            aria-label="Delete transaction"
          >
            <Trash2 className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Sliding card */}
      <motion.div
        drag={swipeEnabled ? 'x' : false}
        dragConstraints={{ left: -SNAP_DISTANCE, right: 0 }}
        dragElastic={0.07}
        onDragEnd={handleDragEnd}
        style={{ x, borderLeft: `3px solid ${color}` }}
        onClick={swiped ? closeSwipe : undefined}
        className={cn(
          "relative flex items-center gap-3 px-4 py-3.5 bg-card select-none transition-opacity",
          isPending && "opacity-70"
        )}
      >
        {/* Icon */}
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}18`, border: `1.5px solid ${color}28` }}
          >
            <CategoryIcon icon={icon} color={color} />
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
            <p className="flex-1 min-w-0 truncate text-[13.5px] font-semibold text-white/90 leading-none">
              {descriptionNode ?? tx.description}
            </p>
            <div className="shrink-0 text-right leading-none">
              <span className={cn(
                'text-[14px] font-bold tabular-nums',
                myShare < 0 ? 'text-emerald-400' : 'text-white/85'
              )}>
                {myShare < 0 ? '+' : '−'}{formattedAmount}
              </span>
              {showConverted && formattedConverted && (
                <p className="text-[10px] font-bold tabular-nums mt-0.5 px-1 py-[1px] rounded bg-primary/15 text-primary/80">
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
                className="shrink-0 text-[10px] font-bold px-1.5 py-[2px] rounded capitalize leading-none"
                style={{ backgroundColor: `${color}18`, color }}
              >
                {isSettlement ? 'Settlement' : getCategoryLabel(tx.category)}
              </span>
              <span className="shrink-0 text-white/20 text-[10px]">·</span>
              <span className="shrink-0 text-[11px] text-white/35 font-medium leading-none">{paidByLabel}</span>
              <span className="shrink-0 text-white/20 text-[10px]">·</span>
              <span className="shrink-0 text-[11px] text-white/35 font-medium tabular-nums leading-none">
                {formatDate(parseISO(tx.date.slice(0, 10)), 'short')}
              </span>
              {/* Location indicator */}
              {tx.place_name && (
                tx.place_name === 'Online'
                  ? <Globe className="shrink-0 w-3 h-3 text-blue-400/60 ml-0.5" aria-label="Online purchase" />
                  : <MapPin className="shrink-0 w-3 h-3 text-emerald-400/50 ml-0.5" aria-label="Has location" />
              )}
              {/* Receipt indicator — tap to open viewer */}
              {tx.receipt_path && onViewReceipt && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onViewReceipt(); }}
                  className="shrink-0 ml-0.5 p-0.5 -m-0.5 rounded text-sky-300/70 hover:text-sky-300 transition-colors"
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
                      className="shrink-0 ml-0.5 p-0.5 -m-0.5 rounded text-amber-300/70 hover:text-amber-300 transition-colors"
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
                <span className="shrink-0 flex items-center gap-1 px-1.5 py-[2px] rounded bg-sky-500/10 text-sky-400 border border-sky-500/15 text-[10px] font-medium ml-1" aria-label="Waiting to sync">
                  <Cloud className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                  Syncing
                </span>
              )}
              {isFailed && (
                <span className="shrink-0 flex items-center gap-1 px-1.5 py-[2px] rounded bg-rose-500/10 text-rose-400 border border-rose-500/15 text-[10px] font-medium ml-1" title={tx._syncError || undefined} aria-label="Sync failed">
                  <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
                  Failed
                </span>
              )}
              {tx.tags && tx.tags.length > 0 && (
                <span className="shrink-0 flex items-center gap-1 ml-0.5 truncate" aria-label={`Tags: ${tx.tags.join(', ')}`}>
                  <span className="text-white/20 text-[10px]">·</span>
                  <span className="text-[10.5px] text-primary font-semibold leading-none truncate">
                    {tx.tags.slice(0, 3).map(t => `#${t}`).join(' ')}
                    {tx.tags.length > 3 && <span className="text-white/40"> +{tx.tags.length - 3}</span>}
                  </span>
                </span>
              )}
            </div>

            {/* Right: dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="shrink-0 p-1 rounded-full hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card/98 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl min-w-[140px]">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onHistory(); }}
                  className="rounded-lg cursor-pointer gap-2 text-[13px]"
                >
                  <History className="w-3.5 h-3.5" />
                  History
                </DropdownMenuItem>
                {tx.receipt_path && onViewReceipt && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onViewReceipt(); }}
                    className="rounded-lg cursor-pointer gap-2 text-[13px]"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    View receipt
                  </DropdownMenuItem>
                )}
                {canEdit && !isSettlement && !hasSplits && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onEdit(); }}
                      className="rounded-lg cursor-pointer gap-2 text-[13px]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="rounded-lg cursor-pointer text-destructive focus:text-destructive gap-2 text-[13px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 3: badges */}
          {(bucketChip || tx.is_recurring || tx.exclude_from_allowance || isSettlement) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {bucketChip}
              {isSettlement && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-emerald-500/10 text-[10px] text-emerald-400 border border-emerald-500/10 font-medium shrink-0">
                  <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                  Settlement
                </span>
              )}
              {tx.is_recurring && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-cyan-500/10 text-[10px] text-cyan-400 border border-cyan-500/10 font-medium shrink-0">
                  <RefreshCcw className="w-2.5 h-2.5 shrink-0" />
                  Recurring
                </span>
              )}
              {tx.exclude_from_allowance && (
                <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-md bg-rose-500/10 text-[10px] text-rose-400 border border-rose-500/10 font-medium shrink-0">
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
            className="absolute bottom-2 right-10 flex items-center gap-0.5 text-[9px] text-white/25 font-medium pointer-events-none select-none"
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
