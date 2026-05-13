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
    credit_limit: number | null;
    color: string;
    icon: string;
    is_primary: boolean;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
};
