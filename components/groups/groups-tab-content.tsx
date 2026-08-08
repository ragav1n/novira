import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Plus, Settings2, LogOut, FileText, Home, Plane, Heart, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/utils/haptics';
import type { Group, Friend, Split } from '@/components/providers/groups-provider';
import { simplifyDebtsForGroup } from '@/utils/simplify-debts';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { GroupSettingsDialog } from './group-settings-dialog';
import { GroupDetailSheet } from './group-detail-sheet';

interface GroupsTabContentProps {
    groups: Group[];
    friends: Friend[];
    currentUserId: string | null;
    pendingSplits: Split[];
    currency: string;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    addMemberToGroup: (groupId: string, friendId: string) => Promise<boolean | void>;
    leaveGroup: (groupId: string) => Promise<boolean | void>;
    onStartGroup: () => void;
}

type TypeKey = 'home' | 'trip' | 'couple' | 'other';

const TYPE_TOKENS: Record<TypeKey, { icon: React.ElementType; text: string; bg: string; ring: string; rail: string }> = {
    home: {
        icon: Home,
        text: 'text-emerald-400',
        bg: 'bg-emerald-400/[0.06]',
        ring: 'ring-emerald-400/15',
        rail: 'bg-emerald-400',
    },
    trip: {
        icon: Plane,
        text: 'text-sky-400',
        bg: 'bg-sky-400/[0.06]',
        ring: 'ring-sky-400/15',
        rail: 'bg-sky-400',
    },
    couple: {
        icon: Heart,
        text: 'text-rose-400',
        bg: 'bg-rose-400/[0.06]',
        ring: 'ring-rose-400/15',
        rail: 'bg-rose-400',
    },
    other: {
        icon: FileText,
        text: 'text-primary',
        bg: 'bg-primary/[0.06]',
        ring: 'ring-primary/15',
        rail: 'bg-primary',
    },
};

const parseDateOnly = (iso: string) => parseISO(iso.slice(0, 10));

export function GroupsTabContent({
    groups, friends, currentUserId, pendingSplits, currency, formatCurrency, convertAmount,
    leaveGroup, onStartGroup,
}: GroupsTabContentProps) {
    const { confirm, dialog } = useConfirm();
    const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);
    const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
    const [pastOpen, setPastOpen] = useState(false);
    const settingsGroup = settingsGroupId ? groups.find(g => g.id === settingsGroupId) ?? null : null;
    const detailGroup = detailGroupId ? groups.find(g => g.id === detailGroupId) ?? null : null;

    const groupBalances = useMemo(() => {
        if (!currentUserId) return new Map<string, { owe: number; owed: number }>();
        const out = new Map<string, { owe: number; owed: number }>();
        for (const group of groups) {
            const debts = simplifyDebtsForGroup(pendingSplits, currentUserId, convertAmount, currency, group.id);
            const owe = debts.filter(p => p.from === currentUserId).reduce((a, p) => a + p.amount, 0);
            const owed = debts.filter(p => p.to === currentUserId).reduce((a, p) => a + p.amount, 0);
            out.set(group.id, { owe, owed });
        }
        return out;
    }, [groups, pendingSplits, currentUserId, convertAmount, currency]);

    const groupSplitCounts = useMemo(() => {
        const out = new Map<string, number>();
        for (const split of pendingSplits) {
            const gid = split.transaction?.group_id;
            if (!gid) continue;
            out.set(gid, (out.get(gid) || 0) + 1);
        }
        return out;
    }, [pendingSplits]);

    const sortedGroups = [...groups].sort((a, b) => {
        if (a.type === 'home' && b.type !== 'home') return -1;
        if (a.type !== 'home' && b.type === 'home') return 1;
        const aIsTrip = a.type === 'trip';
        const bIsTrip = b.type === 'trip';
        const now = new Date();
        const aIsPastTrip = aIsTrip && a.end_date && parseDateOnly(a.end_date) < now;
        const bIsPastTrip = bIsTrip && b.end_date && parseDateOnly(b.end_date) < now;

        if (aIsPastTrip && !bIsPastTrip) return 1;
        if (!aIsPastTrip && bIsPastTrip) return -1;

        if (aIsTrip && bIsTrip && !aIsPastTrip && !bIsPastTrip) {
            if (a.start_date && b.start_date) {
                return parseDateOnly(a.start_date).getTime() - parseDateOnly(b.start_date).getTime();
            }
        }
        return 0;
    });

    const activeGroups = sortedGroups.filter(g => {
        if (g.type !== 'trip') return true;
        if (!g.end_date) return true;
        return parseDateOnly(g.end_date) >= new Date();
    });

    const pastTrips = sortedGroups.filter(g => {
        if (g.type !== 'trip') return false;
        return g.end_date && parseDateOnly(g.end_date) < new Date();
    });

    return (
        <div className="space-y-3">
            {settingsGroup && (
                <GroupSettingsDialog
                    group={settingsGroup}
                    friends={friends}
                    currentUserId={currentUserId}
                    pendingSplits={pendingSplits}
                    open={!!settingsGroupId}
                    onOpenChange={(open) => { if (!open) setSettingsGroupId(null); }}
                />
            )}
            {detailGroup && (
                <GroupDetailSheet
                    group={detailGroup}
                    currentUserId={currentUserId}
                    pendingSplits={pendingSplits}
                    currency={currency}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                    open={!!detailGroupId}
                    onOpenChange={(open) => { if (!open) setDetailGroupId(null); }}
                />
            )}

            {activeGroups.length > 0 ? (
                activeGroups.map((group, idx) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        balance={groupBalances.get(group.id)}
                        openSplitsCount={groupSplitCounts.get(group.id) || 0}
                        formatCurrency={formatCurrency}
                        onOpenDetail={() => setDetailGroupId(group.id)}
                        onOpenSettings={() => setSettingsGroupId(group.id)}
                        onLeave={() => {
                            confirm({
                                title: `Leave ${group.name}?`,
                                description: "You'll lose access to this group's expenses and balances. Any unsettled debts stay recorded — rejoining requires a new invite.",
                                confirmLabel: 'Leave group',
                                onConfirm: async () => {
                                    try {
                                        await leaveGroup(group.id);
                                        toast.success('Left group successfully');
                                    } catch (error: unknown) {
                                        const msg = error instanceof Error ? error.message : 'Failed to leave group';
                                        toast.error(msg);
                                    }
                                },
                            });
                        }}
                        animationDelay={idx * 0.04}
                    />
                ))
            ) : (
                pastTrips.length === 0 && <NoActiveGroupsState onStartGroup={onStartGroup} />
            )}

            {pastTrips.length > 0 && (
                <div className="pt-3">
                    <button
                        type="button"
                        onClick={() => setPastOpen(v => !v)}
                        className="group flex items-center gap-2 w-full px-1 py-2 text-left"
                        aria-expanded={pastOpen}
                    >
                        <span className="text-eyebrow uppercase text-muted-foreground/60 group-hover:text-foreground/70 transition-colors">
                            Past trips · {pastTrips.length}
                        </span>
                        <span className="h-px flex-1 bg-white/[0.05]" />
                        {pastOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />}
                    </button>
                    {pastOpen && (
                        <ul className="space-y-px mt-2 rounded-xl overflow-hidden border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            {pastTrips.map((g) => (
                                <li key={g.id}>
                                    <button
                                        type="button"
                                        onClick={() => setDetailGroupId(g.id)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.025] hover:bg-white/[0.05] transition-colors text-left"
                                    >
                                        <span className="flex items-center gap-2.5 min-w-0">
                                            <Plane className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                            <span className="text-body font-medium truncate">{g.name}</span>
                                        </span>
                                        <span className="text-meta text-muted-foreground/60 tabular-nums shrink-0 ml-3">
                                            {g.end_date && format(parseDateOnly(g.end_date), 'MMM yyyy')}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {dialog}
        </div>
    );
}

function GroupCard({
    group, balance, openSplitsCount, formatCurrency, onOpenDetail, onOpenSettings, onLeave, animationDelay,
}: {
    group: Group;
    balance?: { owe: number; owed: number };
    openSplitsCount: number;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    onOpenDetail: () => void;
    onOpenSettings: () => void;
    onLeave: () => void;
    animationDelay: number;
}) {
    const type = (group.type as TypeKey) || 'other';
    const tokens = TYPE_TOKENS[type];
    const Icon = tokens.icon;

    const isTrip = type === 'trip';
    const isCouple = type === 'couple';
    const isHome = type === 'home';

    const tripMeta = useMemo(() => {
        if (!isTrip || !group.start_date) return null;
        const start = parseDateOnly(group.start_date);
        const end = group.end_date ? parseDateOnly(group.end_date) : start;
        const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
        const elapsed = Math.max(0, Math.min(totalDays, differenceInCalendarDays(new Date(), start) + 1));
        const progress = (elapsed / totalDays) * 100;
        const isUpcoming = start > new Date();
        return { start, end, totalDays, elapsed, progress, isUpcoming };
    }, [isTrip, group.start_date, group.end_date]);

    const owesYou = balance && balance.owed > 0.01;
    const youOwe = balance && balance.owe > 0.01;

    return (
        <article
            onClick={onOpenDetail}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDetail();
                }
            }}
            style={{ animationDelay: `${animationDelay}s` }}
            className={cn(
                'relative overflow-hidden rounded-xl bg-white/[0.035] border border-white/10 ring-1 ring-inset transition-colors cursor-pointer hover:bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_6px_16px_-8px_rgba(0,0,0,0.55)]',
                tokens.ring,
            )}
        >
            {/* left accent rail */}
            <span className={cn('absolute left-0 top-3 bottom-3 w-[2px] rounded-r', tokens.rail)} aria-hidden="true" />

            <div className="p-4 pl-[18px]">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                tokens.bg, tokens.text,
                            )}
                        >
                            <Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="text-lead font-semibold tracking-tight truncate">{group.name}</h4>
                                {isHome && (
                                    <span className="text-micro font-medium uppercase tracking-[0.14em] px-1.5 py-px rounded text-emerald-400/90 bg-emerald-400/10">
                                        Home
                                    </span>
                                )}
                            </div>
                            <p className="text-meta text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <span>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                                {isTrip && tripMeta && (
                                    <>
                                        <span className="text-muted-foreground/30">·</span>
                                        <span className={tokens.text}>
                                            {format(tripMeta.start, 'MMM d')}
                                            {group.end_date && ` – ${format(tripMeta.end, 'MMM d')}`}
                                        </span>
                                    </>
                                )}
                                {openSplitsCount > 0 && (
                                    <>
                                        <span className="text-muted-foreground/30">·</span>
                                        <span>
                                            <span className="tabular-nums">{openSplitsCount}</span> open split{openSplitsCount !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* gap-2 and 44px targets: Settings and Leave Group were ~26px and
                        2px apart, so a mis-tap left the group. */}
                    <div className="flex items-center gap-2 -mr-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="min-h-[44px] min-w-[44px] -my-2 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-colors"
                            title="Group settings"
                            aria-label={`Settings for ${group.name}`}
                            onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                        >
                            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                            className="min-h-[44px] min-w-[44px] -my-2 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                            title="Leave Group"
                            aria-label={`Leave ${group.name}`}
                            onClick={(e) => { e.stopPropagation(); onLeave(); }}
                        >
                            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Bottom row: members + balance */}
                <div className="flex items-center justify-between mt-3.5">
                    {isCouple && group.members.length >= 2 ? (
                        <div className="flex items-center gap-1.5">
                            {group.members.slice(0, 2).map((m, i) => (
                                <Avatar key={m.user_id || i} className="w-7 h-7 ring-2 ring-background">
                                    <AvatarImage src={m.avatar_url || ''} />
                                    <AvatarFallback className="text-caption font-semibold">
                                        {m.full_name?.substring(0, 1) || '?'}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            <Heart className="w-3 h-3 text-rose-400/60 ml-0.5" aria-hidden="true" />
                        </div>
                    ) : (
                        <div className="flex items-center -space-x-1.5">
                            {group.members.slice(0, 4).map((m, i) => (
                                <Avatar key={m.user_id || i} className="w-6 h-6 ring-[1.5px] ring-background">
                                    <AvatarImage src={m.avatar_url || ''} />
                                    <AvatarFallback className="text-micro">
                                        {m.full_name?.substring(0, 1) || '?'}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {group.members.length > 4 && (
                                <span className="w-6 h-6 rounded-full bg-secondary text-micro font-semibold flex items-center justify-center ring-[1.5px] ring-background">
                                    +{group.members.length - 4}
                                </span>
                            )}
                        </div>
                    )}

                    {balance && (owesYou || youOwe) ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-eyebrow uppercase text-muted-foreground/60">
                                {youOwe ? 'You owe' : "You're owed"}
                            </span>
                            <span
                                className={cn(
                                    'text-xs font-bold tabular-nums',
                                    youOwe ? 'text-rose-300' : 'text-emerald-300',
                                )}
                            >
                                {formatCurrency(youOwe ? balance.owe : balance.owed)}
                            </span>
                        </div>
                    ) : balance ? (
                        <span className="text-eyebrow uppercase text-muted-foreground/60">
                            Settled up
                        </span>
                    ) : null}
                </div>

                {/* Trip progress micro-bar */}
                {isTrip && tripMeta && !tripMeta.isUpcoming && (
                    <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-caption text-muted-foreground">
                            <span>Day {tripMeta.elapsed} of {tripMeta.totalDays}</span>
                        </div>
                        <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full', tokens.rail)}
                                style={{ width: `${tripMeta.progress}%` }}
                            />
                        </div>
                    </div>
                )}
                {isTrip && tripMeta?.isUpcoming && (
                    <p className="mt-3 text-caption text-muted-foreground inline-flex items-center gap-1.5">
                        Starts in {Math.max(0, differenceInCalendarDays(tripMeta.start, new Date()))} days
                        <ArrowRight className="w-2.5 h-2.5" />
                    </p>
                )}
            </div>
        </article>
    );
}

function NoActiveGroupsState({ onStartGroup }: { onStartGroup: () => void }) {
    return (
        <EmptyState
            eyebrow="No active groups"
            title="Make a group, start splitting."
            description="Home, trip, couple, or whatever else — Novira keeps the math."
            action={{ label: 'Start a group', icon: Plus, onClick: onStartGroup }}
            secondaryAction={{ label: 'How groups work \u2192', href: '/guide#groups' }}
        />
    );
}
