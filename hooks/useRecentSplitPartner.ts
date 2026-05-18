import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RecentSplitPartner {
    userId: string;
    count: number;
}

// Finds the most-frequent split counterparty across the user's last 30 days,
// counting BOTH directions: expenses the user paid (and split with friends)
// AND expenses friends paid where the user was added as a debtor.
// Used by the add-expense form's "Quick split 50/50" chip.
export function useRecentSplitPartner(userId: string | null | undefined): RecentSplitPartner | null {
    const [partner, setPartner] = useState<RecentSplitPartner | null>(null);

    useEffect(() => {
        if (!userId) {
            setPartner(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const since = new Date();
                since.setDate(since.getDate() - 30);
                const sinceStr = since.toISOString().slice(0, 10);

                // Direction A: user paid → count distinct debtors on their splits.
                // Direction B: friend paid for user → count distinct payers (transaction owner).
                const [paidByMe, paidForMe] = await Promise.all([
                    supabase
                        .from('transactions')
                        .select('id, user_id, splits(user_id), date')
                        .eq('user_id', userId)
                        .gte('date', sinceStr)
                        .limit(200),
                    supabase
                        .from('splits')
                        .select('user_id, transaction:transactions!inner(user_id, date)')
                        .eq('user_id', userId)
                        .gte('transaction.date', sinceStr)
                        .limit(200),
                ]);

                if (cancelled) return;
                if (paidByMe.error) console.error('split-partner (paid by me) error:', paidByMe.error);
                if (paidForMe.error) console.error('split-partner (paid for me) error:', paidForMe.error);

                const tallies = new Map<string, number>();
                const addTally = (uid: string) => {
                    if (!uid || uid === userId) return;
                    tallies.set(uid, (tallies.get(uid) || 0) + 1);
                };

                for (const row of (paidByMe.data || []) as { user_id: string; splits: { user_id: string }[] | null }[]) {
                    for (const s of row.splits || []) addTally(s.user_id);
                }
                // Supabase's inner-join returns the joined row as either an object or an
                // array depending on relationship inference — handle both shapes.
                for (const row of (paidForMe.data || []) as {
                    transaction: { user_id: string } | { user_id: string }[] | null;
                }[]) {
                    const tx = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
                    if (tx?.user_id) addTally(tx.user_id);
                }

                let best: RecentSplitPartner | null = null;
                for (const [uid, count] of tallies) {
                    if (!best || count > best.count) best = { userId: uid, count };
                }
                setPartner(best);
            } catch (err) {
                console.error('Failed to load recent split partner:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    return partner;
}
