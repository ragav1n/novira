import React, { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import type { Friend, Split } from '@/components/providers/groups-provider';
import { simplifyDebtsForFriend } from '@/utils/simplify-debts';

interface FriendsTabContentProps {
    friendRequests: Friend[];
    friends: Friend[];
    currentUserId: string | null;
    pendingSplits: Split[];
    currency: string;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    acceptFriendRequest: (requestId: string) => Promise<void>;
    declineFriendRequest: (requestId: string) => Promise<void>;
    removeFriend: (requestId: string) => Promise<void>;
}

export function FriendsTabContent({
    friendRequests, friends, currentUserId, pendingSplits, currency, formatCurrency, convertAmount,
    acceptFriendRequest, declineFriendRequest, removeFriend,
}: FriendsTabContentProps) {
    const friendBalances = useMemo(() => {
        if (!currentUserId) return new Map<string, { owe: number; owed: number }>();
        const out = new Map<string, { owe: number; owed: number }>();
        for (const f of friends) {
            const debts = simplifyDebtsForFriend(pendingSplits, currentUserId, convertAmount, currency, f.id);
            const owe = debts.filter(p => p.from === currentUserId).reduce((a, p) => a + p.amount, 0);
            const owed = debts.filter(p => p.to === currentUserId).reduce((a, p) => a + p.amount, 0);
            out.set(f.id, { owe, owed });
        }
        return out;
    }, [friends, pendingSplits, currentUserId, convertAmount, currency]);

    const friendSplitCounts = useMemo(() => {
        const out = new Map<string, number>();
        if (!currentUserId) return out;
        for (const split of pendingSplits) {
            const payer = split.transaction?.user_id;
            const debtor = split.user_id;
            const friendId = payer === currentUserId ? debtor : debtor === currentUserId ? payer : null;
            if (!friendId) continue;
            out.set(friendId, (out.get(friendId) || 0) + 1);
        }
        return out;
    }, [pendingSplits, currentUserId]);

    return (
        <div className="space-y-5">
            {friendRequests.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                            <span className="animate-ping absolute inset-0 rounded-full bg-amber-400/50" />
                            <span className="relative rounded-full h-2 w-2 bg-amber-400" />
                        </span>
                        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-400">
                            Needs review · {friendRequests.length}
                        </h3>
                    </div>
                    <ul className="rounded-2xl overflow-hidden border border-amber-400/25 bg-amber-400/[0.06] divide-y divide-amber-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_4px_12px_-6px_rgba(0,0,0,0.45)]">
                        {friendRequests.map((request) => (
                            <li
                                key={request.id}
                                className="flex items-center justify-between gap-3 px-3 py-2.5"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="w-9 h-9 ring-1 ring-amber-400/20 shrink-0">
                                        <AvatarImage src={request.avatar_url || ''} />
                                        <AvatarFallback className="text-[11px] font-semibold bg-amber-400/10 text-amber-300">
                                            {(request.full_name || request.email)?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold truncate">
                                            {request.full_name || request.email?.split('@')[0]}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">{request.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        aria-label="Decline"
                                        onClick={async () => {
                                            try {
                                                if (request.request_id) {
                                                    await declineFriendRequest(request.request_id);
                                                    toast.success('Request declined');
                                                }
                                            } catch (error) {
                                                console.error('[friends] decline failed', error);
                                                toast.error('Failed to decline');
                                            }
                                        }}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                if (request.request_id) {
                                                    await acceptFriendRequest(request.request_id);
                                                    toast.success('Friend added');
                                                }
                                            } catch (error) {
                                                toast.error('Failed to accept');
                                                console.error(error);
                                            }
                                        }}
                                        className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-amber-400 text-amber-950 text-[11px] font-semibold hover:bg-amber-300 transition-colors"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Accept
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section>
                {friends.length > 0 && (
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 px-1 mb-2">
                        Friends · {friends.length}
                    </h3>
                )}
                {friends.length > 0 ? (
                    <ul className="rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_4px_12px_-6px_rgba(0,0,0,0.45)]">
                        {friends.map((friend) => {
                            const bal = friendBalances.get(friend.id);
                            const youOwe = bal && bal.owe > 0.01;
                            const owedToYou = bal && bal.owed > 0.01;
                            const sharedSplits = friendSplitCounts.get(friend.id) || 0;
                            return (
                                <li
                                    key={friend.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white/[0.025] hover:bg-white/[0.05] transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar className="w-9 h-9 ring-1 ring-white/[0.06] shrink-0">
                                            <AvatarImage src={friend.avatar_url || ''} />
                                            <AvatarFallback className="text-[11px] font-semibold">
                                                {(friend.full_name || friend.email)?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold truncate">
                                                {friend.full_name || friend.email?.split('@')[0]}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {friend.email}
                                                {sharedSplits > 0 && (
                                                    <>
                                                        <span className="text-muted-foreground/30 mx-1.5" aria-hidden="true">·</span>
                                                        <span className="tabular-nums">{sharedSplits}</span> shared split{sharedSplits !== 1 ? 's' : ''}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {youOwe || owedToYou ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                                                    {youOwe ? 'You owe' : 'Owes you'}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-[12px] font-bold tabular-nums',
                                                        youOwe ? 'text-rose-300' : 'text-emerald-300',
                                                    )}
                                                >
                                                    {formatCurrency(youOwe ? bal!.owe : bal!.owed)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                                                Settled
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`Remove ${friend.full_name || 'friend'}`}
                                            onClick={() => {
                                                toast(`Remove ${friend.full_name || 'friend'}?`, {
                                                    action: {
                                                        label: 'Remove',
                                                        onClick: async () => {
                                                            try {
                                                                if (friend.request_id) {
                                                                    await removeFriend(friend.request_id);
                                                                    toast.success('Friend removed');
                                                                }
                                                            } catch (error) {
                                                                console.error('[friends] remove failed', error);
                                                                const message = error instanceof Error ? error.message : 'Failed to remove friend';
                                                                toast.error(message);
                                                            }
                                                        },
                                                    },
                                                });
                                            }}
                                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                                        >
                                            <UserMinus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    friendRequests.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 space-y-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                                No friends yet
                            </p>
                            <h3 className="text-base font-semibold tracking-tight">
                                Add someone to split with.
                            </h3>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                                Use the add-friend button in the header — by email, ID, or QR scan.
                            </p>
                        </div>
                    )
                )}
            </section>
        </div>
    );
}
