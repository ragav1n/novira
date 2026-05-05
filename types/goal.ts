export const GOAL_COLOR_KEYS = ['emerald', 'cyan', 'violet', 'rose', 'amber', 'sky', 'fuchsia', 'slate'] as const;
export type GoalColor = typeof GOAL_COLOR_KEYS[number];

export const GOAL_ICON_KEYS = [
    'target', 'piggy', 'plane', 'home', 'car', 'graduation',
    'heart', 'gift', 'briefcase', 'sparkles', 'mountain', 'camera',
] as const;
export type GoalIcon = typeof GOAL_ICON_KEYS[number];

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
    last_threshold_notified?: number | null;
    last_deadline_notified?: string | null;
}

export interface SavingsDeposit {
    id: string;
    goal_id: string;
    user_id: string;
    amount: number;
    currency: string;
    created_at: string;
}
