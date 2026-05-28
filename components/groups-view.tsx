'use client';

import { motion } from 'framer-motion';

import React, { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Plus, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useGroups } from './providers/groups-provider';
import { useUserPreferences } from './providers/user-preferences-provider';
import { useBuckets } from './providers/buckets-provider';

import { AddFriendDialog } from './groups/add-friend-dialog';
import { GroupCreationDialog } from './groups/group-creation-dialog';

import { BucketsTabContent } from './groups/buckets-tab-content';
import { GroupsTabContent } from './groups/groups-tab-content';
import { FriendsTabContent } from './groups/friends-tab-content';
import { SettlementsTabContent } from './groups/settlements-tab-content';
import { TripsTabContent } from './groups/trips-tab-content';
import { GroupsSkeleton } from './groups/groups-skeleton';

const VALID_TABS = ['groups', 'personal', 'friends', 'trips', 'settlements'] as const;
type GroupsTab = typeof VALID_TABS[number];

const TAB_META: Record<GroupsTab, { label: string; accent: string }> = {
    groups: { label: 'Groups', accent: 'text-primary' },
    personal: { label: 'Personal', accent: 'text-cyan-400' },
    friends: { label: 'Friends', accent: 'text-primary' },
    trips: { label: 'Trips', accent: 'text-sky-400' },
    settlements: { label: 'Settle', accent: 'text-amber-400' },
};

export function GroupsView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        groups, friends, friendRequests, balances, pendingSplits, simplifiedDebts, loading,
        addMemberToGroup, settleSplit, settleSplitsBatch, acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend
    } = useGroups();
    const { formatCurrency, userId, currency, convertAmount } = useUserPreferences();

    const { buckets, archiveBucket, deleteBucket, bucketSpending } = useBuckets();

    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [addFriendOpen, setAddFriendOpen] = useState(false);

    const tabFromUrl = searchParams?.get('tab');
    const activeTab: GroupsTab = (VALID_TABS as readonly string[]).includes(tabFromUrl ?? '')
        ? (tabFromUrl as GroupsTab)
        : 'groups';

    const handleTabChange = useCallback((value: string) => {
        const url = value === 'groups' ? '/groups' : `/groups?tab=${value}`;
        router.replace(url, { scroll: false });
    }, [router]);

    const showGroupHeaderActions = activeTab === 'groups' || activeTab === 'friends';

    const showSkeleton = loading && groups.length === 0 && friends.length === 0;
    const isFirstTime = !loading && groups.length === 0 && friends.length === 0 && friendRequests.length === 0;

    const net = balances.totalOwedToMe - balances.totalOwed;
    const netSign = Math.abs(net) < 0.01 ? 'flat' : net > 0 ? 'positive' : 'negative';
    const netLabel = netSign === 'positive' ? "Net you're owed"
        : netSign === 'negative' ? 'Net you owe'
        : 'All settled';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-screen w-full bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,_rgba(138,43,226,0.18),_transparent_60%)]"
        >
            <div className="p-5 space-y-7 max-w-md lg:max-w-2xl mx-auto relative pb-24 lg:pb-8">
                {/* Header */}
                <div className="relative flex items-center gap-3 min-h-[40px]">
                    <button
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors shrink-0 z-10"
                    >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <h2 className="absolute inset-0 flex items-center justify-center pointer-events-none text-[15px] font-semibold tracking-tight">
                        Groups &amp; friends
                    </h2>
                    <div className="flex items-center gap-1.5 ml-auto z-10">
                        <AddFriendDialog userId={userId} open={addFriendOpen} onOpenChange={setAddFriendOpen} />
                        <GroupCreationDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
                        {showGroupHeaderActions && (
                            <>
                                <button
                                    onClick={() => setAddFriendOpen(true)}
                                    aria-label="Add friend"
                                    className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <UserPlus className="w-[18px] h-[18px]" />
                                </button>
                                <button
                                    onClick={() => setCreateGroupOpen(true)}
                                    aria-label="Create group"
                                    className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <Plus className="w-[18px] h-[18px]" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {showSkeleton ? (
                    <GroupsSkeleton />
                ) : isFirstTime ? (
                    <FirstTimeBlock
                        onAddFriend={() => setAddFriendOpen(true)}
                        onCreateGroup={() => setCreateGroupOpen(true)}
                    />
                ) : (
                    <>
                        {/* Net-position hero */}
                        <section className="space-y-3">
                            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                                {netLabel}
                            </p>
                            {netSign === 'flat' ? (
                                <h3 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground/85">
                                    You&apos;re all settled.
                                </h3>
                            ) : (
                                <>
                                    <div className="flex items-end gap-3">
                                        <h3
                                            className={cn(
                                                'text-[40px] leading-none font-bold tracking-tight tabular-nums',
                                                netSign === 'positive' ? 'text-emerald-400' : 'text-rose-400',
                                            )}
                                        >
                                            {formatCurrency(Math.abs(net))}
                                        </h3>
                                        <span className="text-[11px] text-muted-foreground/70 mb-1.5">
                                            across {pendingSplits.length} split{pendingSplits.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <BalanceChip
                                            label="Owed to you"
                                            value={formatCurrency(balances.totalOwedToMe)}
                                            tone="positive"
                                            id="owed-to-me-section"
                                        />
                                        <BalanceChip
                                            label="You owe"
                                            value={formatCurrency(balances.totalOwed)}
                                            tone="negative"
                                            id="i-owe-section"
                                        />
                                    </div>
                                </>
                            )}
                            <StatsStrip
                                groupsCount={groups.length}
                                friendsCount={friends.length}
                                openSplitsCount={pendingSplits.length}
                            />
                        </section>

                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="w-full grid grid-cols-5 bg-transparent p-0 h-auto rounded-none border-b border-white/[0.06]">
                                {(Object.keys(TAB_META) as GroupsTab[]).map((tab) => {
                                    const meta = TAB_META[tab];
                                    const active = activeTab === tab;
                                    return (
                                        <TabsTrigger
                                            key={tab}
                                            value={tab}
                                            className={cn(
                                                'relative h-11 rounded-none bg-transparent text-[12px] sm:text-[13px] font-medium tracking-tight transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                                                active ? meta.accent : 'text-muted-foreground/60 hover:text-foreground/80',
                                            )}
                                        >
                                            {meta.label}
                                            {active && (
                                                <motion.span
                                                    layoutId="groups-tab-indicator"
                                                    className={cn(
                                                        'absolute -bottom-px left-2 right-2 h-px',
                                                        meta.accent.replace('text-', 'bg-'),
                                                    )}
                                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                />
                                            )}
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>

                            <TabsContent value="personal" className="mt-5 focus-visible:outline-none">
                                <BucketsTabContent
                                    buckets={buckets}
                                    bucketSpending={bucketSpending}
                                    formatCurrency={formatCurrency}
                                    currency={currency}
                                    archiveBucket={archiveBucket}
                                    deleteBucket={deleteBucket}
                                />
                            </TabsContent>

                            <TabsContent value="groups" className="mt-5 focus-visible:outline-none">
                                <GroupsTabContent
                                    groups={groups}
                                    friends={friends}
                                    currentUserId={userId}
                                    pendingSplits={pendingSplits}
                                    currency={currency}
                                    formatCurrency={formatCurrency}
                                    convertAmount={convertAmount}
                                    addMemberToGroup={addMemberToGroup}
                                    leaveGroup={leaveGroup}
                                    onStartGroup={() => setCreateGroupOpen(true)}
                                />
                            </TabsContent>

                            <TabsContent value="trips" className="mt-5 focus-visible:outline-none">
                                <TripsTabContent />
                            </TabsContent>

                            <TabsContent value="friends" className="mt-5 focus-visible:outline-none">
                                <FriendsTabContent
                                    friendRequests={friendRequests}
                                    friends={friends}
                                    currentUserId={userId}
                                    pendingSplits={pendingSplits}
                                    currency={currency}
                                    formatCurrency={formatCurrency}
                                    convertAmount={convertAmount}
                                    acceptFriendRequest={acceptFriendRequest}
                                    declineFriendRequest={declineFriendRequest}
                                    removeFriend={removeFriend}
                                />
                            </TabsContent>

                            <TabsContent value="settlements" className="mt-5 focus-visible:outline-none">
                                <SettlementsTabContent
                                    simplifiedDebts={simplifiedDebts}
                                    pendingSplits={pendingSplits}
                                    userId={userId}
                                    currency={currency}
                                    formatCurrency={formatCurrency}
                                    convertAmount={convertAmount}
                                    settleSplit={settleSplit}
                                    settleSplitsBatch={settleSplitsBatch}
                                />
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>
        </motion.div>
    );
}

function StatsStrip({
    groupsCount, friendsCount, openSplitsCount,
}: {
    groupsCount: number;
    friendsCount: number;
    openSplitsCount: number;
}) {
    const items = [
        { count: groupsCount, label: groupsCount === 1 ? 'group' : 'groups' },
        { count: friendsCount, label: friendsCount === 1 ? 'friend' : 'friends' },
        ...(openSplitsCount > 0
            ? [{ count: openSplitsCount, label: openSplitsCount === 1 ? 'open split' : 'open splits' }]
            : []),
    ];
    if (items.length === 0) return null;
    return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-[11px] text-muted-foreground">
            {items.map((item, i) => (
                <React.Fragment key={item.label}>
                    {i > 0 && <span className="text-muted-foreground/30" aria-hidden="true">·</span>}
                    <span>
                        <span className="font-semibold text-foreground/85 tabular-nums">{item.count}</span>{' '}
                        {item.label}
                    </span>
                </React.Fragment>
            ))}
        </p>
    );
}

function BalanceChip({
    label, value, tone, id,
}: {
    label: string;
    value: string;
    tone: 'positive' | 'negative';
    id?: string;
}) {
    return (
        <div
            id={id}
            className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                tone === 'positive'
                    ? 'border-emerald-400/25 bg-emerald-400/[0.08]'
                    : 'border-rose-400/25 bg-rose-400/[0.08]',
            )}
        >
            <span
                className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    tone === 'positive' ? 'bg-emerald-400' : 'bg-rose-400',
                )}
                aria-hidden="true"
            />
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span
                className={cn(
                    'text-[12px] font-bold tabular-nums',
                    tone === 'positive' ? 'text-emerald-300' : 'text-rose-300',
                )}
            >
                {value}
            </span>
        </div>
    );
}

function FirstTimeBlock({
    onAddFriend, onCreateGroup,
}: {
    onAddFriend: () => void;
    onCreateGroup: () => void;
}) {
    return (
        <section className="pt-8 space-y-6">
            <div className="space-y-2 max-w-xs">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                    Start here
                </p>
                <h3 className="text-2xl font-bold tracking-tight">
                    Split anything with anyone.
                </h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Add a friend or spin up a group — home, trip, couple — and Novira tracks
                    who owes who from there.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onAddFriend}
                    className="group flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.035] border border-white/10 hover:border-primary/30 hover:bg-primary/[0.06] transition-colors text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                    <UserPlus className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-[13px] font-semibold">Add a friend</span>
                    <span className="text-[11px] text-muted-foreground">By email, ID, or QR</span>
                </button>
                <button
                    onClick={onCreateGroup}
                    className="group flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.035] border border-white/10 hover:border-primary/30 hover:bg-primary/[0.06] transition-colors text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                    <Plus className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-[13px] font-semibold">Create a group</span>
                    <span className="text-[11px] text-muted-foreground">Home, trip, couple, custom</span>
                </button>
            </div>
        </section>
    );
}
