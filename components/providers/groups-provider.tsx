'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
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
    createGroup: (name: string) => Promise<string | null>;
    addFriendByEmail: (email: string) => Promise<boolean>;
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

    const refreshData = async (currentSession?: any) => {
        try {
            let session = currentSession;
            if (!session) {
                const { data } = await supabase.auth.getSession();
                session = data.session;
            }
            const user = session?.user;
            if (!user) return;

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
                    g.members.some((m: any) => m.user_id === user.id)
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
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (friendsError) throw friendsError;

            if (allFriendships) {
                const acceptedFriends: Friend[] = [];
                const incomingRequests: Friend[] = [];

                allFriendships.forEach(f => {
                    // Determine if I am the initiator or the recipient
                    const isInitiator = f.user_id === user.id;
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
                        // Pending request sent TO me
                        incomingRequests.push(friendObj);
                    }
                    // We ignore pending requests initiated BY me for now, or could show them as "Sent"
                });

                setFriends(acceptedFriends);
                setFriendRequests(incomingRequests);
            }

            // 3. Calculate Balances
            const { data: splitsIOwe, error: oweError } = await supabase
                .from('splits')
                .select('amount')
                .eq('user_id', user.id)
                .eq('is_paid', false);

            if (oweError) throw oweError;
            const totalOwed = splitsIOwe?.reduce((acc, s) => acc + Number(s.amount), 0) || 0;

            const { data: splitsOwedToMe, error: owedToMeError } = await supabase
                .from('splits')
                .select(`
                    amount,
                    transactions!inner(user_id)
                `)
                .eq('transactions.user_id', user.id)
                .eq('is_paid', false);

            if (owedToMeError) throw owedToMeError;
            const totalOwedToMe = splitsOwedToMe?.reduce((acc, s) => acc + Number(s.amount), 0) || 0;

            setBalances({ totalOwed, totalOwedToMe });

            // 4. Fetch Pending Splits (Split into 2 queries to avoid OR syntax issues with foreign tables)

            // 4a. Splits I owe (I am the debtor)
            const { data: myDebts, error: debtError } = await supabase
                .from('splits')
                .select(`
                    *,
                    transaction:transactions(description, date, user_id, profile:profiles(full_name))
                `)
                .eq('user_id', user.id)
                .eq('is_paid', false);

            if (debtError) throw debtError;

            // 4b. Splits owed to me (I am the creditor - I paid for the transaction)
            const { data: myCredits, error: creditError } = await supabase
                .from('splits')
                .select(`
                    *,
                    transaction:transactions!inner(description, date, user_id, profile:profiles(full_name))
                `)
                .eq('transactions.user_id', user.id)
                .eq('is_paid', false);

            if (creditError) throw creditError;

            const allPending = [...(myDebts || []), ...(myCredits || [])];

            // Deduplicate if necessary (though logic above should be mutually exclusive mostly)
            const uniquePending = Array.from(new Map(allPending.map(item => [item.id, item])).values());

            if (uniquePending.length > 0) {
                const formatted = uniquePending.map((s: any) => ({
                    ...s,
                    transaction: {
                        ...s.transaction,
                        payer_name: s.transaction?.profile?.full_name
                    }
                }));
                // Sort by date (newest first)
                formatted.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
                setPendingSplits(formatted);
            } else {
                setPendingSplits([]);
            }

        } catch (error: any) {
            console.error('CRITICAL: Groups/Friends fetch failed!', error);
            if (error.code) console.error('Error Code:', error.code);
            if (error.message) console.error('Error Message:', error.message);
            if (error.details) console.error('Error Details:', error.details);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();

        // Subscribe to auth state changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                refreshData(session);
            } else if (event === 'SIGNED_OUT') {
                setGroups([]);
                setFriends([]);
                setFriendRequests([]);
                setBalances({ totalOwed: 0, totalOwedToMe: 0 });
                setPendingSplits([]);
            }
        });

        const channel = supabase.channel('splits-and-groups')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'splits' }, () => refreshData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => refreshData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => refreshData())
            .subscribe();
        return () => {
            authSubscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const createGroup = async (name: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        const { data: group, error } = await supabase
            .from('groups')
            .insert({ name, created_by: session.user.id })
            .select()
            .single();

        if (error) throw error;

        const { error: memberError } = await supabase.from('group_members').insert({
            group_id: group.id,
            user_id: session.user.id
        });

        if (memberError) throw memberError;

        refreshData();
        return group.id;
    };

    const addFriendByEmail = async (email: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        // Use secure RPC to find user by email (bypassing RLS)
        const { data: friendProfileData, error: searchError } = await supabase
            .rpc('get_profile_by_email', { email_input: email })
            .single();

        const friendProfile = friendProfileData as { id: string, full_name: string, avatar_url: string | null } | null;

        if (searchError || !friendProfile) {
            throw new Error('User not found. They must be registered with Novira.');
        }

        if (friendProfile.id === session.user.id) {
            throw new Error("You cannot add yourself as a friend");
        }

        const { error: friendError } = await supabase
            .from('friendships')
            .insert({
                user_id: session.user.id,
                friend_id: friendProfile.id,
                status: 'pending' // Changed to pending
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', session.user.id);

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

    const addMemberToGroup = async (groupId: string, userId: string) => {
        const { error } = await supabase
            .from('group_members')
            .insert({ group_id: groupId, user_id: userId });
        if (error) throw error;
        refreshData();
        return true;
    };

    const settleSplit = async (splitId: string) => {
        const { error } = await supabase
            .from('splits')
            .update({ is_paid: true })
            .eq('id', splitId);
        if (error) throw error;
        refreshData();
        return true;
    };

    return (
        <GroupsContext.Provider value={{
            groups, friends, friendRequests, balances, pendingSplits, loading,
            refreshData, createGroup, addFriendByEmail, addMemberToGroup, settleSplit,
            acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend
        }}>
            {children}
        </GroupsContext.Provider>
    );
}

export function useGroups() {
    const context = useContext(GroupsContext);
    if (context === undefined) { throw new Error('useGroups must be used within a GroupsProvider'); }
    return context;
}
