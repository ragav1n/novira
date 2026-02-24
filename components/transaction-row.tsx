'use client';

import React, { memo } from 'react';
import { format } from 'date-fns';
import { History, MoreVertical, Users, RefreshCcw, Ban } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TransactionRowProps {
  tx: any; // Assuming 'Transaction' type is not available in the original context, keeping 'any'
  userId: string | null; // Keeping original type
  myShare: number;
  formattedAmount: string;
  formattedConverted?: string;
  showConverted: boolean; // Keeping original type
  canEdit: boolean;
  icon: React.ReactNode;
  color?: string; // New color prop
  bucketChip: React.ReactNode | null; // Keeping original type
  onHistory: () => void; // Keeping original type
  onEdit: () => void; // Keeping original type
  onDelete: () => void; // Keeping original type
}

export const TransactionRow = memo(function TransactionRow({
  tx,
  userId,
  myShare,
  formattedAmount,
  formattedConverted,
  showConverted,
  canEdit,
  icon,
  color = '#8A2BE2', // Default to Electric Purple
  bucketChip,
  onHistory,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const hasSplits = tx.splits && tx.splits.length > 0;
  const isSettlement = tx.is_settlement;
  const showDropdown = canEdit && !isSettlement && !hasSplits;

  return (
    <div className="flex items-start gap-4 p-4.5 rounded-2xl bg-card/30 border border-white/5 hover:bg-card/50 transition-all duration-300 group shadow-md relative mt-2 first:mt-0">
      {/* Icon */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center border shadow-inner transition-colors duration-300"
          style={{
            backgroundColor: `${color}20`, // 20% opacity background
            borderColor: `${color}40`,     // 40% opacity border
          }}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<any>, {
                style: { color: color },
                className: cn((icon as React.ReactElement<any>).props.className, "transition-colors duration-300")
              })
            : icon
          }
        </div>
        {hasSplits && (
          <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center border border-background shadow-sm">
            <Users className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[44px]">
        {/* Row 1: Description + Amount */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-[15px] font-bold text-white/95 truncate leading-tight flex-1" title={tx.description}>
            {tx.description}
          </span>
          <div className="flex flex-col items-end shrink-0">
            <span
              className={cn(
                'text-[16px] font-bold tracking-tight tabular-nums leading-none',
                myShare < 0 ? 'text-emerald-500' : 'text-white'
              )}
            >
              {myShare < 0 ? '+' : '-'}{formattedAmount}
            </span>
            {showConverted && formattedConverted && (
              <div className="text-[11px] text-emerald-500/90 font-bold leading-none bg-emerald-500/5 px-1 rounded-sm mt-1">
                ≈ {formattedConverted}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-2 text-[11px] text-white/30 font-medium leading-none flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 capitalize shrink-0 font-extrabold tracking-tight">
              {tx.category}
            </span>
            <span className="shrink-0 opacity-20">•</span>
            <span className="shrink-0 truncate max-w-[100px] text-primary/80 font-bold">
              {tx.user_id === userId
                ? 'You paid'
                : `Paid by ${tx.profile?.full_name?.split(' ')[0] || 'Unknown'}`}
            </span>
            <span className="shrink-0 opacity-20">•</span>
            <span className="shrink-0">{format(new Date(tx.date), 'MMM d')}</span>
          </div>

          {/* Action buttons — optimized for the new row height */}
          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
            <button
              onClick={(e) => { e.stopPropagation(); onHistory(); }}
              className="p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-primary transition-colors active:scale-90"
              title="View History"
            >
              <History className="w-4 h-4" />
            </button>

            {showDropdown && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-primary transition-colors active:scale-90"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card/98 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl">
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="rounded-lg cursor-pointer gap-2"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="rounded-lg cursor-pointer text-destructive focus:text-destructive gap-2"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Row 3: Bucket + Recurring + Excluded badges */}
        {(tx.bucket_id || tx.is_recurring || tx.exclude_from_allowance) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap min-h-[14px]">
            {bucketChip}
            {tx.is_recurring && (
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-[10px] text-cyan-400 border border-cyan-500/10 font-bold flex items-center gap-1 shrink-0">
                <RefreshCcw className="w-2.5 h-2.5 shrink-0 opacity-80" />
                Recurring
              </span>
            )}
            {tx.exclude_from_allowance && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-[10px] text-rose-400 border border-rose-500/10 font-bold flex items-center gap-1 shrink-0">
                <Ban className="w-2.5 h-2.5 shrink-0 opacity-80" />
                Excluded
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
