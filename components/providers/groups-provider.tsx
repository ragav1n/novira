'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { useUserPreferences } from './user-preferences-provider';
import { simplifyDebts, type SimplifiedPayment } from '@/utils/simplify-debts';

interface Group {
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

interface Friend {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email?: string;
    status?: 'accepted' | 'pending';
    request_id?: string; // The ID of the friendship record, useful for accepting/declining
}

interface Split {
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
    };
}

interface Balances {
    totalOwed: number; // You owe
    totalOwedToMe: number; // You are owed
}

interface GroupsContextType {
    groups: Group[];
    friends: Friend[];
    friendRequests: Friend[]; // Incoming requests
    balances: Balances;
    pendingSplits: Split[];
    loading: boolean;
    refreshData: () => Promise<void>;
    createGroup: (name: string, type?: 'home' | 'trip' | 'couple' | 'other', startDate?: Date, endDate?: Date) => Promise<string | null>;
    addFriendByEmail: (email: string) => Promise<boolean>;
    addFriendById: (friendId: string) => Promise<boolean>;
    addMemberToGroup: (groupId: string, userId: string) => Promise<boolean>;
    settleSplit: (splitId: string) => Promise<boolean>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
    declineFriendRequest: (requestId: string) => Promise<void>;
    leaveGroup: (groupId: string) => Promise<void>;
    removeFriend: (friendshipId: string) => Promise<void>;
    simplifiedDebts: SimplifiedPayment[];
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
                        profile:profiles(full_name),
                        transaction:transactions(description, date, user_id, currency, exchange_rate, base_currency, profile:profiles(full_name))
                    `)
                    .eq('user_id', userId)
                    .eq('is_paid', false),
                // 4. My credits (pending splits owed to me)
                supabase
                    .from('splits')
                    .select(`
                        *,
                        profile:profiles(full_name),
                        transaction:transactions!inner(description, date, user_id, currency, exchange_rate, base_currency, profile:profiles(full_name))
                    `)
                    .eq('transactions.user_id', userId)
                    .eq('is_paid', false)
            ]);

            // Process Groups
            if (groupsResult.error) throw groupsResult.error;
            if (groupsResult.data) {
                const formattedGroups = groupsResult.data.map(g => ({
                    ...g,
                    members: (g.members || []).map((m: any) => ({
                        user_id: m.user_id,
                        full_name: m.profile?.full_name || 'Unknown',
                        avatar_url: m.profile?.avatar_url,
                        email: m.profile?.email || ''
                    }))
                }));
                setGroups(formattedGroups.filter(g =>
                    g.members.some((m: any) => m.user_id === userId)
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

            const totalOwed = (myDebtsResult.data || []).reduce((acc: number, s: any) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;
                if (tx.currency === userCurrency) return acc + amount;
                return acc + convertAmount(amount, tx.currency);
            }, 0);

            const totalOwedToMe = (myCreditsResult.data || []).reduce((acc: number, s: any) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;
                if (tx.currency === userCurrency) return acc + amount;
                return acc + convertAmount(amount, tx.currency);
            }, 0);

            setBalances({ totalOwed, totalOwedToMe });

            // Process Pending Splits
            const allPending = [...(myDebtsResult.data || []), ...(myCreditsResult.data || [])];
            const uniquePending = Array.from(new Map(allPending.map(item => [item.id, item])).values());

            if (uniquePending.length > 0) {
                const formatted = uniquePending.map((s: any) => {
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
                            date: s.created_at,
                            payer_name: payerName
                        }
                    };
                });

                formatted.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
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

    useEffect(() => {
        if (!userId) return;

        // Initial fetch
        refreshData();

        let channel: ReturnType<typeof supabase.channel> | null = null;

        // Debounce subscription to prevent rapid reconnects during strict mode or auth state settling
        const timer = setTimeout(() => {
            channel = supabase.channel(`realtime-groups-${userId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'splits' }, () => {
                    debouncedRefresh();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
                    debouncedRefresh();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
                    debouncedRefresh();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
                    debouncedRefresh();
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `or(user_id.eq.${userId},friend_id.eq.${userId})`
                }, () => {
                    debouncedRefresh();
                })
                .subscribe((status, err) => {
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Realtime Channel Error:', err);
                    }
                    if (status === 'TIMED_OUT') {
                        console.error('Realtime Connection Timed Out');
                    }
                });
        }, 500);

        return () => {
            clearTimeout(timer);
            if (channel) {
                supabase.removeChannel(channel);
            }
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

    const settleSplit = useCallback(async (splitId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase.rpc('settle_split', { split_id: splitId });

        if (error) throw error;

        refreshData();
        return true;
    }, [userId, refreshData]);

    const computedSimplifiedDebts = useMemo(() => {
        if (!userId || pendingSplits.length === 0) return [];
        return simplifyDebts(pendingSplits, userId, convertAmount, userCurrency);
    }, [pendingSplits, userId, convertAmount, userCurrency]);

    const contextValue = useMemo(() => ({
        groups, friends, friendRequests, balances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend,
        simplifiedDebts: computedSimplifiedDebts
    }), [
        groups, friends, friendRequests, balances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend,
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
