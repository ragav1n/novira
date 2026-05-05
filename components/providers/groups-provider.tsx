'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { useUserPreferences } from './user-preferences-provider';
import { simplifyDebts, type SimplifiedPayment } from '@/utils/simplify-debts';

export interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    type?: 'home' | 'trip' | 'couple' | 'other';
    start_date?: string;
    end_date?: string;
    members: {
        user_id: string;
        full_name: string;
        avatar_url: string | null;
        email: string;
    }[];
}

export interface Friend {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email?: string;
    status?: 'accepted' | 'pending';
    request_id?: string; // The ID of the friendship record, useful for accepting/declining
}

export interface Split {
    id: string;
    transaction_id: string;
    user_id: string;
    amount: number;
    is_paid: boolean;
    transaction?: {
        description: string;
        date: string;
        user_id: string;
        payer_name?: string;
        currency?: string;
        exchange_rate?: number;
        base_currency?: string;
        group_id?: string | null;
        profile?: { full_name?: string; avatar_url?: string | null } | null;
    };
}

interface Balances {
    totalOwed: number; // You owe
    totalOwedToMe: number; // You are owed
}

export type GroupType = 'home' | 'trip' | 'couple' | 'other';

export interface UpdateGroupPatch {
    name?: string;
    type?: GroupType;
    start_date?: string | null;
    end_date?: string | null;
}

interface GroupsContextType {
    groups: Group[];
    friends: Friend[];
    friendRequests: Friend[]; // Incoming requests
    balances: Balances;
    pendingSplits: Split[];
    loading: boolean;
    refreshData: () => Promise<void>;
    createGroup: (name: string, type?: GroupType, startDate?: Date, endDate?: Date) => Promise<string | null>;
    addFriendByEmail: (email: string) => Promise<boolean>;
    addFriendById: (friendId: string) => Promise<boolean>;
    addMemberToGroup: (groupId: string, userId: string) => Promise<boolean>;
    settleSplit: (splitId: string, creditorId?: string) => Promise<boolean>;
    settleSplitsBatch: (splitIds: string[], creditorId?: string) => Promise<{ settled: number; total: number }>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
    declineFriendRequest: (requestId: string) => Promise<void>;
    leaveGroup: (groupId: string) => Promise<void>;
    removeFriend: (friendshipId: string) => Promise<void>;
    updateGroup: (groupId: string, patch: UpdateGroupPatch) => Promise<void>;
    deleteGroup: (groupId: string) => Promise<void>;
    removeGroupMember: (groupId: string, memberId: string) => Promise<void>;
    simplifiedDebts: SimplifiedPayment[];
}

interface RawGroupMember {
    user_id: string;
    profile?: {
        full_name: string;
        avatar_url: string | null;
        email: string;
    } | null;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
    const [balances, setBalances] = useState<Balances>({ totalOwed: 0, totalOwedToMe: 0 });
    const [pendingSplits, setPendingSplits] = useState<Split[]>([]);
    const [loading, setLoading] = useState(true);

    const { userId, convertAmount, currency: userCurrency, isLoading: authLoading } = useUserPreferences();

    const refreshData = useCallback(async () => {
        if (!userId) {
            setGroups([]);
            setFriends([]);
            setFriendRequests([]);
            setBalances({ totalOwed: 0, totalOwedToMe: 0 });
            setPendingSplits([]);
            setLoading(false);
            return;
        }

        try {
            // Fire all 4 queries in parallel (balances computed from pending splits)
            const [
                groupsResult,
                friendshipsResult,
                myDebtsResult,
                myCreditsResult
            ] = await Promise.all([
                // 1. Fetch Groups
                supabase
                    .from('groups')
                    .select(`
                        *,
                        members:group_members(
                            user_id,
                            profile:profiles(full_name, avatar_url, email)
                        )
                    `),
                // 2. Fetch Friends and Requests
                supabase
                    .from('friendships')
                    .select(`
                        id,
                        user_id,
                        friend_id,
                        status,
                        friend:profiles!friend_id(id, full_name, avatar_url, email),
                        user:profiles!user_id(id, full_name, avatar_url, email)
                    `)
                    .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
                // 3. My debts (pending splits I owe)
                supabase
                    .from('splits')
                    .select(`
                        *,
                        profile:profiles(full_name, avatar_url),
                        transaction:transactions(description, date, user_id, currency, exchange_rate, base_currency, group_id, profile:profiles(full_name, avatar_url))
                    `)
                    .eq('user_id', userId)
                    .eq('is_paid', false),
                // 4. My credits (pending splits owed to me)
                supabase
                    .from('splits')
                    .select(`
                        *,
                        profile:profiles(full_name, avatar_url),
                        transaction:transactions!inner(description, date, user_id, currency, exchange_rate, base_currency, group_id, profile:profiles(full_name, avatar_url))
                    `)
                    .eq('transaction.user_id', userId)
                    .eq('is_paid', false)
            ]);

            // Process Groups
            if (groupsResult.error) throw groupsResult.error;
            if (groupsResult.data) {
                const formattedGroups = groupsResult.data.map(g => ({
                    ...g,
                    members: (g.members || []).map((m: RawGroupMember) => ({
                        user_id: m.user_id,
                        full_name: m.profile?.full_name || 'Unknown',
                        avatar_url: m.profile?.avatar_url ?? null,
                        email: m.profile?.email || ''
                    }))
                }));
                setGroups(formattedGroups.filter(g =>
                    g.members.some((m: RawGroupMember) => m.user_id === userId)
                ));
            }

            // Process Friends and Requests
            if (friendshipsResult.error) throw friendshipsResult.error;
            if (friendshipsResult.data) {
                const acceptedFriends: Friend[] = [];
                const incomingRequests: Friend[] = [];

                friendshipsResult.data.forEach(f => {
                    const isInitiator = f.user_id === userId;
                    const profileData = isInitiator ? f.friend : f.user;
                    const friendProfile = Array.isArray(profileData) ? profileData[0] : profileData;

                    if (!friendProfile) return;

                    const friendObj: Friend = {
                        id: friendProfile.id,
                        full_name: friendProfile.full_name,
                        avatar_url: friendProfile.avatar_url,
                        email: friendProfile.email,
                        status: f.status as 'accepted' | 'pending',
                        request_id: f.id
                    };

                    if (f.status === 'accepted') {
                        acceptedFriends.push(friendObj);
                    } else if (f.status === 'pending' && !isInitiator) {
                        incomingRequests.push(friendObj);
                    }
                });

                setFriends(acceptedFriends);
                setFriendRequests(incomingRequests);
            }

            // Compute Balances from pending splits (no extra queries needed)
            if (myDebtsResult.error) throw myDebtsResult.error;
            if (myCreditsResult.error) throw myCreditsResult.error;

            const totalOwed = (myDebtsResult.data || []).reduce((acc: number, s: Split) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;
                if (tx.currency === userCurrency) return acc + amount;
                return acc + convertAmount(amount, tx.currency ?? userCurrency);
            }, 0);

            const totalOwedToMe = (myCreditsResult.data || []).reduce((acc: number, s: Split) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;
                if (tx.currency === userCurrency) return acc + amount;
                return acc + convertAmount(amount, tx.currency ?? userCurrency);
            }, 0);

            setBalances({ totalOwed, totalOwedToMe });

            // Process Pending Splits
            const allPending = [...(myDebtsResult.data || []), ...(myCreditsResult.data || [])];
            const uniquePending = Array.from(new Map(allPending.map(item => [item.id, item])).values());

            if (uniquePending.length > 0) {
                type SplitWithJoins = Split & {
                    profile?: { full_name?: string } | null;
                    created_at?: string;
                };
                const formatted = uniquePending.map((s: SplitWithJoins) => {
                    const isCreditor = s.transaction?.user_id === userId;
                    const payerName = isCreditor
                        ? (s.profile?.full_name || 'Friend')
                        : (s.transaction?.profile?.full_name || s.transaction?.payer_name || 'Friend');

                    return {
                        ...s,
                        transaction: s.transaction ? {
                            ...s.transaction,
                            payer_name: payerName
                        } : {
                            description: 'Unknown Transaction',
                            date: s.created_at ?? new Date().toISOString(),
                            user_id: '',
                            payer_name: payerName
                        }
                    } as Split;
                });

                formatted.sort((a, b) => new Date(b.transaction!.date).getTime() - new Date(a.transaction!.date).getTime());
                setPendingSplits(formatted);
            } else {
                setPendingSplits([]);
            }

        } catch (error: any) {
            console.error('CRITICAL: Groups/Friends fetch failed!', error);
            toast.error('Failed to sync financial data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, [userId, userCurrency, convertAmount]);

    // Debounced refresh to batch rapid realtime events
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedRefresh = useCallback(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            refreshData();
        }, 300);
    }, [refreshData]);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    // Generation counter so callbacks from a stale (replaced-but-not-yet-removed)
    // channel during rapid sign-in/out don't kick off refetches against the wrong userId.
    const realtimeGenRef = useRef(0);

    useEffect(() => {
        if (!userId) return;
        const myGen = ++realtimeGenRef.current;
        const guarded = (fn: () => void) => () => {
            if (realtimeGenRef.current !== myGen) return;
            fn();
        };

        // Initial fetch
        refreshData();

        // Listen for expense-added event (fires before navigation, so we catch it here too)
        const handleExpenseAdded = () => refreshData();
        window.addEventListener('novira:expense-added', handleExpenseAdded);

        // Listen for settlement broadcasts from other users
        const settlementChannel = supabase
            .channel(`settlement-notify-${userId}-${myGen}`)
            .on('broadcast', { event: 'settled' }, guarded(() => {
                debouncedRefresh();
                window.dispatchEvent(new Event('novira:expense-added'));
            }))
            .subscribe();

        let channel: ReturnType<typeof supabase.channel> | null = null;

        const timer = setTimeout(() => {
            if (realtimeGenRef.current !== myGen) return;
            channel = supabase.channel(`realtime-groups-${userId}-${myGen}`)
                // splits: no filter — a split can belong to any user involved in the transaction
                .on('postgres_changes', { event: '*', schema: 'public', table: 'splits' }, guarded(() => {
                    debouncedRefresh();
                    // Also refresh the dashboard so settlement transactions appear immediately
                    window.dispatchEvent(new Event('novira:expense-added'));
                }))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, guarded(() => {
                    debouncedRefresh();
                }))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, guarded(() => {
                    debouncedRefresh();
                }))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, guarded(() => {
                    debouncedRefresh();
                }))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, guarded(() => {
                    debouncedRefresh();
                }))
                .subscribe((status, err) => {
                    // Suppress noisy errors when the device is simply offline — Supabase
                    // surfaces a CHANNEL_ERROR with no payload as soon as the websocket
                    // can't reach the server. It'll auto-reconnect when we go back online.
                    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
                    if (status === 'CHANNEL_ERROR' && !offline) {
                        console.error('Realtime Channel Error:', err);
                    }
                    if (status === 'TIMED_OUT' && !offline) {
                        console.error('Realtime Connection Timed Out');
                    }
                });
        }, 500);

        return () => {
            window.removeEventListener('novira:expense-added', handleExpenseAdded);
            supabase.removeChannel(settlementChannel);
            clearTimeout(timer);
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, userCurrency, convertAmount, refreshData, debouncedRefresh]);

    // ... (keep createGroup, addFriendByEmail, etc. methods, but remove getSession calls if they use userId from closure or check context, though some methods might still need separate checks or can use userId from context safely)
    // Actually, for helper methods called by UI, we can use `userId` from context.
    // The previous implementation used getSession inside methods. Use userId from context instead.

    const createGroup = useCallback(async (name: string, type: 'home' | 'trip' | 'couple' | 'other' = 'other', startDate?: Date, endDate?: Date) => {
        if (!userId) throw new Error('Not authenticated');

        const { data: group, error } = await supabase
            .from('groups')
            .insert({
                name,
                created_by: userId,
                type,
                start_date: startDate?.toISOString(),
                end_date: endDate?.toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        const { error: memberError } = await supabase.from('group_members').insert({
            group_id: group.id,
            user_id: userId
        });

        if (memberError) throw memberError;

        refreshData();
        return group.id;
    }, [userId, refreshData]);

    // ... existing addFriendByEmail logic ...

    const addFriendByEmail = useCallback(async (email: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { data: friendProfileData, error: searchError } = await supabase
            .rpc('get_profile_by_email', { email_input: email })
            .single();

        const friendProfile = friendProfileData as { id: string, full_name: string, avatar_url: string | null } | null;

        if (searchError || !friendProfile) {
            throw new Error('User not found. They must be registered with Novira.');
        }

        if (friendProfile.id === userId) {
            throw new Error("You cannot add yourself as a friend");
        }

        const { error: friendError } = await supabase
            .from('friendships')
            .insert({
                user_id: userId,
                friend_id: friendProfile.id,
                status: 'pending'
            });

        if (friendError) {
            if (friendError.code === '23505') {
                throw new Error('You are already friends (or have a pending request) with this user');
            }
            throw friendError;
        }

        refreshData();
        return true;
    }, [userId, refreshData]);

    const addFriendById = useCallback(async (friendId: string) => {
        if (!userId) throw new Error('Not authenticated');

        if (friendId === userId) {
            throw new Error("You cannot add yourself as a friend");
        }

        // Check if user exists first using the secure RPC to bypass RLS
        const { data: friendProfileData, error: searchError } = await supabase
            .rpc('get_profile_by_id', { user_id_input: friendId })
            .single();

        const friendProfile = friendProfileData as { id: string, full_name: string } | null;

        if (searchError || !friendProfile) {
            throw new Error('User not found. Invalid QR code?');
        }

        const { error: friendError } = await supabase
            .from('friendships')
            .insert({
                user_id: userId,
                friend_id: friendId,
                status: 'pending'
            });

        if (friendError) {
            if (friendError.code === '23505') {
                throw new Error('You are already friends (or have a pending request) with this user');
            }
            throw friendError;
        }

        refreshData();
        return true;
    }, [userId, refreshData]);

    const acceptFriendRequest = useCallback(async (requestId: string) => {
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (error) throw error;
        refreshData();
    }, [refreshData]);

    const declineFriendRequest = useCallback(async (requestId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId);

        if (error) throw error;
        refreshData();
    }, [refreshData]);

    const leaveGroup = useCallback(async (groupId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;
        refreshData();
    }, [userId, refreshData]);

    const removeFriend = useCallback(async (friendshipId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) throw error;
        refreshData();
    }, [refreshData]);

    const addMemberToGroup = useCallback(async (groupId: string, memberId: string) => {
        const { error } = await supabase
            .from('group_members')
            .insert({ group_id: groupId, user_id: memberId });
        if (error) throw error;
        refreshData();
        return true;
    }, [refreshData]);

    const updateGroup = useCallback(async (groupId: string, patch: UpdateGroupPatch) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('groups')
            .update(patch)
            .eq('id', groupId);
        if (error) throw error;
        refreshData();
    }, [userId, refreshData]);

    const deleteGroup = useCallback(async (groupId: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.rpc('delete_group', { group_id: groupId });
        if (error) throw error;
        // Optimistic local removal so the card disappears even before realtime fires
        setGroups(prev => prev.filter(g => g.id !== groupId));
        refreshData();
    }, [userId, refreshData]);

    const removeGroupMember = useCallback(async (groupId: string, memberId: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', memberId);
        if (error) throw error;
        refreshData();
    }, [userId, refreshData]);

    const settleSplit = useCallback(async (splitId: string, creditorId?: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase.rpc('settle_split', { split_id: splitId });

        if (error) throw error;

        // Optimistically remove settled split so UI updates instantly
        setPendingSplits(prev => prev.filter(s => s.id !== splitId));

        refreshData();

        // Refresh dashboard transactions on the debtor's side
        sessionStorage.setItem('novira_expense_added', '1');
        window.dispatchEvent(new Event('novira:expense-added'));

        // Notify the creditor's screen via broadcast so they don't need to refresh
        if (creditorId) {
            const notifyChannel = supabase.channel(`settlement-notify-${creditorId}`);
            notifyChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    notifyChannel
                        .send({ type: 'broadcast', event: 'settled', payload: { splitId } })
                        .finally(() => supabase.removeChannel(notifyChannel));
                }
            });
        }

        return true;
    }, [userId, refreshData]);

    const settleSplitsBatch = useCallback(async (splitIds: string[], creditorId?: string) => {
        if (!userId) throw new Error('Not authenticated');
        if (splitIds.length === 0) return { settled: 0, total: 0 };

        // Try the atomic RPC first; fall back to per-split loop if it doesn't exist yet.
        const { error: rpcError } = await supabase.rpc('settle_splits_batch', { split_ids: splitIds });

        const fnMissing = rpcError && (rpcError.code === '42883' || /function .* does not exist/i.test(rpcError.message));

        if (rpcError && !fnMissing) {
            throw rpcError;
        }

        let settled = splitIds.length;

        if (fnMissing) {
            // Fallback: settle one at a time. Reports how many succeeded before any failure.
            settled = 0;
            for (const id of splitIds) {
                const { error } = await supabase.rpc('settle_split', { split_id: id });
                if (error) {
                    if (settled === 0) throw error;
                    break;
                }
                settled++;
            }
        }

        // Optimistically remove all settled splits
        setPendingSplits(prev => prev.filter(s => !splitIds.includes(s.id)));
        refreshData();

        sessionStorage.setItem('novira_expense_added', '1');
        window.dispatchEvent(new Event('novira:expense-added'));

        if (creditorId) {
            const notifyChannel = supabase.channel(`settlement-notify-${creditorId}`);
            notifyChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    notifyChannel
                        .send({ type: 'broadcast', event: 'settled', payload: { splitIds } })
                        .finally(() => supabase.removeChannel(notifyChannel));
                }
            });
        }

        return { settled, total: splitIds.length };
    }, [userId, refreshData]);

    const computedSimplifiedDebts = useMemo(() => {
        if (!userId || pendingSplits.length === 0) return [];
        return simplifyDebts(pendingSplits, userId, convertAmount, userCurrency);
    }, [pendingSplits, userId, convertAmount, userCurrency]);

    // Derive balances from simplified debts so the green/red cards reflect
    // the net amounts after debt cancellation — not the raw split totals.
    const computedBalances = useMemo(() => {
        if (!userId) return { totalOwed: 0, totalOwedToMe: 0 };
        return {
            totalOwed: computedSimplifiedDebts
                .filter(p => p.from === userId)
                .reduce((acc, p) => acc + p.amount, 0),
            totalOwedToMe: computedSimplifiedDebts
                .filter(p => p.to === userId)
                .reduce((acc, p) => acc + p.amount, 0),
        };
    }, [computedSimplifiedDebts, userId]);

    const contextValue = useMemo(() => ({
        groups, friends, friendRequests, balances: computedBalances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit, settleSplitsBatch,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend,
        updateGroup, deleteGroup, removeGroupMember,
        simplifiedDebts: computedSimplifiedDebts
    }), [
        groups, friends, friendRequests, computedBalances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit, settleSplitsBatch,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend,
        updateGroup, deleteGroup, removeGroupMember,
        computedSimplifiedDebts
    ]);

    return (
        <GroupsContext.Provider value={contextValue}>
            {children}
        </GroupsContext.Provider>
    );
}

export function useGroups() {
    const context = useContext(GroupsContext);
    if (context === undefined) { throw new Error('useGroups must be used within a GroupsProvider'); }
    return context;
}
