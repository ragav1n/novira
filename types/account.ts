export type AccountType = 'cash' | 'checking' | 'savings' | 'credit_card' | 'digital_wallet' | 'other';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    cash: 'Cash',
    checking: 'Checking',
    savings: 'Savings',
    credit_card: 'Credit card',
    digital_wallet: 'Digital wallet',
    other: 'Other',
};

export type Account = {
    id: string;
    user_id: string;
    name: string;
    type: AccountType;
    currency: string;
    opening_balance: number;
    /**
     * Per-currency opening balances. Keys are currency codes (e.g. "EUR"),
     * values are numbers. Empty/missing means the legacy single-currency
     * model — fall back to {[account.currency]: opening_balance}.
     */
    opening_balances: Record<string, number>;
    credit_limit: number | null;
    color: string;
    icon: string;
    is_primary: boolean;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
};
