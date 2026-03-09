/**
 * Strict type definition for Savings Goals.
 */
export interface SavingsGoal {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    currency: string;
    deadline: string | null;
    icon: string | null;
    color: string | null;
    group_id?: string | null;
    created_at?: string;
}

export interface SavingsDeposit {
    id: string;
    goal_id: string;
    user_id: string;
    amount: number;
    currency: string;
    created_at: string;
}
