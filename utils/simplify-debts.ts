/**
 * Smart Settlement / Simplify Debts Algorithm
 * 
 * Given a list of pending splits, computes the minimum set of payments
 * needed to settle all debts between users.
 * 
 * Example: A owes B ₹500, B owes C ₹500 → A pays C ₹500 directly (1 payment instead of 2)
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
    /** IDs of the underlying splits that this payment covers */
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
    };
}

/**
 * Computes simplified debts from pending splits.
 * 
 * @param pendingSplits - All pending (unpaid) splits visible to the current user
 * @param currentUserId - The current user's ID
 * @param convertAmount - Currency conversion function (amount, fromCurrency, toCurrency?) => number
 * @param userCurrency - The user's preferred currency code
 * @returns Array of SimplifiedPayment representing the minimum payments needed
 */
export function simplifyDebts(
    pendingSplits: SplitInput[],
    currentUserId: string,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    userCurrency: string
): SimplifiedPayment[] {
    if (pendingSplits.length === 0) return [];

    // Step 1: Build net balances between each pair of (debtor, creditor)
    // netBalance[personId] = positive means they are OWED money, negative means they OWE money
    const netBalance: Record<string, number> = {};
    const nameMap: Record<string, string> = {};
    // Track which splits contribute to each debtor→creditor edge
    const edgeSplits: Record<string, string[]> = {}; // "debtorId→creditorId" => splitIds

    for (const split of pendingSplits) {
        const debtorId = split.user_id;
        const creditorId = split.transaction?.user_id;
        if (!creditorId || debtorId === creditorId) continue;

        // Convert amount to user's currency for uniform comparison
        const splitCurrency = split.transaction?.currency || userCurrency;
        const amountInUserCurrency = splitCurrency !== userCurrency
            ? convertAmount(split.amount, splitCurrency, userCurrency)
            : split.amount;

        // Debtor owes → negative balance, Creditor is owed → positive balance
        netBalance[debtorId] = (netBalance[debtorId] || 0) - amountInUserCurrency;
        netBalance[creditorId] = (netBalance[creditorId] || 0) + amountInUserCurrency;

        // Track names
        if (debtorId === currentUserId) {
            nameMap[debtorId] = 'You';
        }
        if (creditorId === currentUserId) {
            nameMap[creditorId] = 'You';
        }
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

        // Track split IDs per edge
        const edgeKey = `${debtorId}→${creditorId}`;
        if (!edgeSplits[edgeKey]) edgeSplits[edgeKey] = [];
        edgeSplits[edgeKey].push(split.id);
    }

    // Step 2: Greedy algorithm — pair biggest creditor with biggest debtor
    const people = Object.keys(netBalance).filter(id => Math.abs(netBalance[id]) > 0.01);

    // Separate into creditors (positive balance) and debtors (negative balance)
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    for (const id of people) {
        const bal = netBalance[id];
        if (bal > 0.01) {
            creditors.push({ id, amount: bal });
        } else if (bal < -0.01) {
            debtors.push({ id, amount: -bal }); // store as positive for easier math
        }
    }

    // Sort descending by amount
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const payments: SimplifiedPayment[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci];
        const debtor = debtors[di];
        const settleAmount = Math.min(creditor.amount, debtor.amount);

        if (settleAmount > 0.01) {
            // Collect split IDs: find all splits where debtor owes creditor
            const directEdge = `${debtor.id}→${creditor.id}`;
            const relatedSplitIds = edgeSplits[directEdge] || [];

            // Also check if there are transitive splits we should include
            // For simplicity, include all splits involving this debtor
            const allDebtorSplits = Object.entries(edgeSplits)
                .filter(([key]) => key.startsWith(`${debtor.id}→`))
                .flatMap(([, ids]) => ids);

            payments.push({
                from: debtor.id,
                fromName: nameMap[debtor.id] || 'Unknown',
                to: creditor.id,
                toName: nameMap[creditor.id] || 'Unknown',
                amount: Math.round(settleAmount * 100) / 100,
                splitIds: relatedSplitIds.length > 0 ? relatedSplitIds : allDebtorSplits,
            });
        }

        creditor.amount -= settleAmount;
        debtor.amount -= settleAmount;

        if (creditor.amount < 0.01) ci++;
        if (debtor.amount < 0.01) di++;
    }

    return payments;
}
