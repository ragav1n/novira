'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useUserPreferences } from './user-preferences-provider';

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
            // 1. Fetch Groups
            const { data: myGroups, error: groupsError } = await supabase
                .from('groups')
                .select(`
                    *,
                    members:group_members(
                        user_id,
                        profile:profiles(full_name, avatar_url, email)
                    )
                `);

            if (groupsError) throw groupsError;

            if (myGroups) {
                const formattedGroups = myGroups.map(g => ({
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

            // 2. Fetch Friends and Requests
            const { data: allFriendships, error: friendsError } = await supabase
                .from('friendships')
                .select(`
                    id,
                    user_id,
                    friend_id,
                    status,
                    friend:profiles!friend_id(id, full_name, avatar_url, email),
                    user:profiles!user_id(id, full_name, avatar_url, email)
                `)
                .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

            if (friendsError) throw friendsError;

            if (allFriendships) {
                const acceptedFriends: Friend[] = [];
                const incomingRequests: Friend[] = [];

                allFriendships.forEach(f => {
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

            // 3. Calculate Balances with Currency Conversion
            const { data: splitsIOwe, error: oweError } = await supabase
                .from('splits')
                .select(`
                    amount,
                    transaction:transactions(currency, exchange_rate, base_currency)
                `)
                .eq('user_id', userId)
                .eq('is_paid', false);

            if (oweError) throw oweError;

            const totalOwed = splitsIOwe?.reduce((acc, s: any) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;

                if (tx.currency === userCurrency) return acc + amount;

                return acc + convertAmount(amount, tx.currency);
            }, 0) || 0;

            const { data: splitsOwedToMe, error: owedToMeError } = await supabase
                .from('splits')
                .select(`
                    amount,
                    transaction:transactions!inner(user_id, currency, exchange_rate, base_currency)
                `)
                .eq('transaction.user_id', userId)
                .eq('is_paid', false);

            if (owedToMeError) throw owedToMeError;

            const totalOwedToMe = splitsOwedToMe?.reduce((acc, s: any) => {
                const amount = Number(s.amount);
                const tx = s.transaction;
                if (!tx) return acc + amount;

                if (tx.currency === userCurrency) return acc + amount;

                return acc + convertAmount(amount, tx.currency);
            }, 0) || 0;

            setBalances({ totalOwed, totalOwedToMe });

            // 4. Fetch Pending Splits
            const { data: myDebts, error: debtError } = await supabase
                .from('splits')
                .select(`
                    *,
                    profile:profiles(full_name),
                    transaction:transactions(description, date, user_id, currency, exchange_rate, base_currency, profile:profiles(full_name))
                `)
                .eq('user_id', userId)
                .eq('is_paid', false);

            if (debtError) throw debtError;

            const { data: myCredits, error: creditError } = await supabase
                .from('splits')
                .select(`
                    *,
                    profile:profiles(full_name),
                    transaction:transactions!inner(description, date, user_id, currency, exchange_rate, base_currency, profile:profiles(full_name))
                `)
                .eq('transaction.user_id', userId)
                .eq('is_paid', false);

            if (creditError) throw creditError;

            const allPending = [...(myDebts || []), ...(myCredits || [])];
            const uniquePending = Array.from(new Map(allPending.map(item => [item.id, item])).values());

            if (uniquePending.length > 0) {
                const formatted = uniquePending.map((s: any) => {
                    const isCreditor = s.transaction?.user_id === userId;
                    const payerName = isCreditor
                        ? (s.profile?.full_name || 'Unknown')
                        : (s.transaction?.profile?.full_name || 'Unknown');

                    return {
                        ...s,
                        transaction: {
                            ...s.transaction,
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
        } finally {
            setLoading(false);
        }
    }, [userId, userCurrency, convertAmount]);

    useEffect(() => {
        if (!userId) return;

        // Initial fetch
        refreshData();

        let channel: ReturnType<typeof supabase.channel> | null = null;

        // Debounce subscription to prevent rapid reconnects during strict mode or auth state settling
        const timer = setTimeout(() => {
            console.log(`Initializing Realtime connection for ${userId}...`);
            channel = supabase.channel(`realtime-groups-${userId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'splits' }, () => {
                    console.log('Realtime: Splits updated');
                    refreshData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
                    console.log('Realtime: Groups updated');
                    refreshData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
                    console.log('Realtime: Group Members updated');
                    refreshData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
                    console.log('Realtime: Friendships updated', payload);
                    refreshData();
                })
                .subscribe((status, err) => {
                    console.log(`Realtime Subscription Status for ${userId}:`, status);
                    if (status === 'SUBSCRIBED') {
                        // Connected successfully
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Realtime Channel Error:', err);
                        // Suppress toast to avoid startling users on minor bugs/network blips
                        // toast.error(`Realtime Error: ${err?.message || 'Unknown'}`);
                    }
                    if (status === 'TIMED_OUT') {
                        console.error('Realtime Connection Timed Out');
                        // toast.error('Realtime Connection Timed Out. Retrying...');
                    }
                });
        }, 500);

        return () => {
            clearTimeout(timer);
            if (channel) {
                console.log('Cleaning up Realtime subscription...');
                supabase.removeChannel(channel);
            }
        };
    }, [userId, userCurrency, convertAmount, refreshData]);

    // ... (keep createGroup, addFriendByEmail, etc. methods, but remove getSession calls if they use userId from closure or check context, though some methods might still need separate checks or can use userId from context safely)
    // Actually, for helper methods called by UI, we can use `userId` from context.
    // The previous implementation used getSession inside methods. Use userId from context instead.

    const createGroup = async (name: string, type: 'home' | 'trip' | 'couple' | 'other' = 'other', startDate?: Date, endDate?: Date) => {
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
    };

    // ... existing addFriendByEmail logic ...

    const addFriendByEmail = async (email: string) => {
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
    };

    const addFriendById = async (friendId: string) => {
        if (!userId) throw new Error('Not authenticated');

        if (friendId === userId) {
            throw new Error("You cannot add yourself as a friend");
        }

        // Check if user exists first using the secure RPC to bypass RLS
        const { data: friendProfileData, error: searchError } = await supabase
            .rpc('get_profile_by_id', { user_id_input: friendId })
            .single();

        // RPC returns the object directly if single() is used, but type assertion is helpful
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
    };

    const acceptFriendRequest = async (requestId: string) => {
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (error) throw error;
        refreshData();
    };

    const declineFriendRequest = async (requestId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId);

        if (error) throw error;
        refreshData();
    };

    const leaveGroup = async (groupId: string) => {
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;
        refreshData();
    };

    const removeFriend = async (friendshipId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) throw error;
        refreshData();
    };

    const addMemberToGroup = async (groupId: string, memberId: string) => {
        const { error } = await supabase
            .from('group_members')
            .insert({ group_id: groupId, user_id: memberId });
        if (error) throw error;
        refreshData();
        return true;
    };

    const settleSplit = async (splitId: string) => {
        if (!userId) throw new Error('Not authenticated');
        // RPC uses auth.uid() usually on server side, but here we call it.
        // Wait, settle_split RPC likely uses `auth.uid()`? 
        // If it relies on session being present in the connection, we strictly need a valid session.
        // supabase-js client handles passing the token automatically if session exists.
        // `UserPreferencesProvider` ensures we have a session (via its internal logic).

        const { error } = await supabase.rpc('settle_split', { split_id: splitId });

        if (error) throw error;

        refreshData();
        return true;
    };

    const contextValue = useMemo(() => ({
        groups, friends, friendRequests, balances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend
    }), [
        groups, friends, friendRequests, balances, pendingSplits, loading,
        refreshData, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit,
        acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend
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
