'use client';

import { motion } from 'framer-motion';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, Plus, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGroups } from './providers/groups-provider';
import { useUserPreferences } from './providers/user-preferences-provider';
import { useBuckets } from './providers/buckets-provider';

// Imported Extracted Dialogs
import { AddFriendDialog } from './groups/add-friend-dialog';
import { GroupCreationDialog } from './groups/group-creation-dialog';

// Imported Extracted Tab Contents
import { BucketsTabContent } from './groups/buckets-tab-content';
import { GroupsTabContent } from './groups/groups-tab-content';
import { FriendsTabContent } from './groups/friends-tab-content';
import { SettlementsTabContent } from './groups/settlements-tab-content';
import { GroupsSkeleton } from './groups/groups-skeleton';

export function GroupsView() {
    const router = useRouter();
    const {
        groups, friends, friendRequests, balances, pendingSplits, simplifiedDebts, loading,
        addMemberToGroup, settleSplit, settleSplitsBatch, acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend
    } = useGroups();
    const { formatCurrency, userId, currency, convertAmount } = useUserPreferences();

    const { buckets, archiveBucket, deleteBucket, bucketSpending } = useBuckets();

    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [addFriendOpen, setAddFriendOpen] = useState(false);

    const showSkeleton = loading && groups.length === 0 && friends.length === 0;
    const isFirstTime = !loading && groups.length === 0 && friends.length === 0 && friendRequests.length === 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-screen w-full"
        >
            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative pb-24 lg:pb-8">
                {/* Header */}
            <div className="flex items-center justify-between relative min-h-[40px]">
                <button
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h2 className="text-lg font-semibold truncate px-12">Groups & Friends</h2>
                </div>
                <div className="flex gap-2 shrink-0 z-10">
                    <AddFriendDialog userId={userId} open={addFriendOpen} onOpenChange={setAddFriendOpen} />
                    <button
                        onClick={() => setAddFriendOpen(true)}
                        aria-label="Add friend"
                        className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20"
                    >
                        <UserPlus className="w-5 h-5" />
                    </button>
                    <GroupCreationDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
                    <button
                        onClick={() => setCreateGroupOpen(true)}
                        aria-label="Create group"
                        className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {showSkeleton ? (
                <GroupsSkeleton />
            ) : isFirstTime ? (
                <Card className="bg-card/40 border-primary/20 rounded-3xl overflow-hidden">
                    <CardContent className="p-6 text-center space-y-4">
                        <h3 className="font-bold text-lg">Welcome to Groups</h3>
                        <p className="text-xs text-muted-foreground">
                            Add a friend or create a group to start splitting expenses.
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => setAddFriendOpen(true)}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
                            >
                                <UserPlus className="w-6 h-6 text-primary" />
                                <span className="text-xs font-bold">Add Friend</span>
                            </button>
                            <button
                                onClick={() => setCreateGroupOpen(true)}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
                            >
                                <Plus className="w-6 h-6 text-primary" />
                                <span className="text-xs font-bold">Create Group</span>
                            </button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
            {/* Balance Overview */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-500/10 border-emerald-500/20 rounded-3xl">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center" id="owed-to-me-section">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[11px] text-emerald-500 font-bold uppercase tracking-wider">You are owed</p>
                        <h4 className="text-xl font-bold text-emerald-500">{formatCurrency(balances.totalOwedToMe)}</h4>
                    </CardContent>
                </Card>
                <Card className="bg-rose-500/10 border-rose-500/20 rounded-3xl">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center" id="i-owe-section">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
                            <ArrowUpRight className="w-5 h-5 text-rose-500" />
                        </div>
                        <p className="text-[11px] text-rose-500 font-bold uppercase tracking-wider">You owe</p>
                        <h4 className="text-xl font-bold text-rose-500">{formatCurrency(balances.totalOwed)}</h4>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="groups" className="w-full">
                <TabsList className="w-full grid grid-cols-4 bg-secondary/40 p-1 rounded-2xl h-12 backdrop-blur-md">
                    <TabsTrigger value="groups" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-white/40 border border-transparent data-[state=active]:border-white/20 transition-all font-bold">Groups</TabsTrigger>
                    <TabsTrigger value="personal" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-white data-[state=inactive]:text-white/40 border border-transparent data-[state=active]:border-white/20 transition-all font-bold">Personal</TabsTrigger>
                    <TabsTrigger value="friends" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-white/40 border border-transparent data-[state=active]:border-white/20 transition-all font-bold">Friends</TabsTrigger>
                    <TabsTrigger value="settlements" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-white/40 border border-transparent data-[state=active]:border-white/20 transition-all font-bold">Settlements</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="mt-6 space-y-6">
                    <BucketsTabContent
                        buckets={buckets}
                        bucketSpending={bucketSpending}
                        formatCurrency={formatCurrency}
                        currency={currency}
                        archiveBucket={archiveBucket}
                        deleteBucket={deleteBucket}
                    />
                </TabsContent>

                <TabsContent value="groups" className="mt-6 space-y-4">
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

                <TabsContent value="friends" className="mt-6 space-y-4">
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

                <TabsContent value="settlements" className="mt-6 space-y-4">
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
