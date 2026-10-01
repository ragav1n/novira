/**
 * Smart Settlement / Simplify Debts Algorithm
 *
 * Given a list of pending splits, nets the debts within each pair of people into
 * one payment: A owes B ₹500 and B owes A ₹200 → A pays B ₹300.
 *
 * Netting stops at the pair. Chaining A→B→C into A→C would ask A to pay someone
 * they may never have split with, and no split exists between them for the
 * settle button to mark — while the A→B split it *would* touch is worth more
 * than the payment shown.
 */

export interface SimplifiedPayment {
    /** User ID of the person who should pay */
    from: string;
    /** Display name of the payer */
    fromName: string;
    /** User ID of the person who should receive */
    to: string;
    /** Display name of the receiver */
    toName: string;
    /** Amount in the user's currency */
    amount: number;
    /** IDs of the underlying splits (both directions) that this payment settles */
    splitIds: string[];
}

interface SplitInput {
    id: string;
    user_id: string; // debtor
    amount: number;
    transaction?: {
        user_id: string; // creditor (transaction owner)
        currency?: string;
        payer_name?: string;
        group_id?: string | null;
    };
}

/**
 * Computes one net payment per pair of people from pending splits.
 *
 * @param pendingSplits - All pending (unpaid) splits visible to the current user
 * @param currentUserId - The current user's ID
 * @param convertAmount - Currency conversion function (amount, fromCurrency, toCurrency?) => number
 * @param userCurrency - The user's preferred currency code
 * @returns Array of SimplifiedPayment, one per pair with a non-zero net balance
 */
export function simplifyDebts(
    pendingSplits: SplitInput[],
    currentUserId: string,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    userCurrency: string
): SimplifiedPayment[] {
    if (pendingSplits.length === 0) return [];

    const nameMap: Record<string, string> = {};
    // Keyed by the pair sorted lexically; `net` > 0 means `a` owes `b`.
    const pairs = new Map<string, { a: string; b: string; net: number; splitIds: string[] }>();

    for (const split of pendingSplits) {
        const debtorId = split.user_id;
        const creditorId = split.transaction?.user_id;
        if (!creditorId || debtorId === creditorId) continue;

        // Convert amount to user's currency for uniform comparison
        const splitCurrency = split.transaction?.currency || userCurrency;
        const amountInUserCurrency = splitCurrency !== userCurrency
            ? convertAmount(split.amount, splitCurrency, userCurrency)
            : split.amount;

        if (debtorId === currentUserId) nameMap[debtorId] = 'You';
        if (creditorId === currentUserId) nameMap[creditorId] = 'You';
        if (split.transaction?.payer_name) {
            // payer_name in pendingSplits context:
            // - If I'm the creditor (transaction owner), payer_name = debtor's name
            // - If I'm the debtor, payer_name = creditor's name
            if (debtorId === currentUserId) {
                nameMap[creditorId] = nameMap[creditorId] || split.transaction.payer_name;
            } else {
                nameMap[debtorId] = nameMap[debtorId] || split.transaction.payer_name;
            }
        }

        const [a, b] = debtorId < creditorId ? [debtorId, creditorId] : [creditorId, debtorId];
        const key = `${a}|${b}`;
        let pair = pairs.get(key);
        if (!pair) {
            pair = { a, b, net: 0, splitIds: [] };
            pairs.set(key, pair);
        }
        pair.net += debtorId === a ? amountInUserCurrency : -amountInUserCurrency;
        pair.splitIds.push(split.id);
    }

    const payments: SimplifiedPayment[] = [];
    for (const { a, b, net, splitIds } of pairs.values()) {
        if (Math.abs(net) <= 0.01) continue;
        const [from, to] = net > 0 ? [a, b] : [b, a];
        payments.push({
            from,
            fromName: nameMap[from] || 'Unknown',
            to,
            toName: nameMap[to] || 'Unknown',
            amount: Math.round(Math.abs(net) * 100) / 100,
            splitIds,
        });
    }

    return payments.sort((x, y) => y.amount - x.amount);
}

/**
 * Simplified debts filtered to a single group. Useful for "who owes whom in *this* trip."
 * Splits without a matching `transaction.group_id` are dropped.
 */
export function simplifyDebtsForGroup(
    pendingSplits: SplitInput[],
    currentUserId: string,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    userCurrency: string,
    groupId: string
): SimplifiedPayment[] {
    const filtered = pendingSplits.filter(s => s.transaction?.group_id === groupId);
    return simplifyDebts(filtered, currentUserId, convertAmount, userCurrency);
}

/**
 * Simplified debts filtered to splits between the current user and a single counterparty.
 * Useful for "settle up with Alice" across all groups & personal splits.
 */
export function simplifyDebtsForFriend(
    pendingSplits: SplitInput[],
    currentUserId: string,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    userCurrency: string,
    friendId: string
): SimplifiedPayment[] {
    const filtered = pendingSplits.filter(s => {
        const debtor = s.user_id;
        const creditor = s.transaction?.user_id;
        if (!creditor) return false;
        const involvesMe = debtor === currentUserId || creditor === currentUserId;
        const involvesFriend = debtor === friendId || creditor === friendId;
        return involvesMe && involvesFriend;
    });
    return simplifyDebts(filtered, currentUserId, convertAmount, userCurrency);
}
