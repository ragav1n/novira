import { supabase } from '@/lib/supabase';
import { SavingsGoal, SavingsDeposit } from '@/types/goal';
import { toast } from '@/utils/haptics';

const GOAL_SELECT = 'id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at, last_threshold_notified, last_deadline_notified';
const DEPOSIT_SELECT = 'id, goal_id, user_id, amount, currency, created_at';

export const GoalService = {
    async getGoals(userId: string, workspaceId?: string | null) {
        let query = supabase
            .from('savings_goals')
            .select(GOAL_SELECT)
            .order('created_at', { ascending: false });

        if (workspaceId) {
            query = query.eq('group_id', workspaceId);
        } else {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching goals:', error);
            throw error;
        }
        return data as SavingsGoal[];
    },

    async createGoal(userId: string, data: Partial<SavingsGoal>) {
        const { data: goal, error } = await supabase
            .from('savings_goals')
            .insert({ ...data, user_id: userId })
            .select(GOAL_SELECT)
            .single();

        if (error) {
            toast.error('Failed to create goal');
            throw error;
        }
        toast.success('Goal created successfully!');
        return goal as SavingsGoal;
    },

    async updateGoal(id: string, data: Partial<SavingsGoal>) {
        const { error } = await supabase
            .from('savings_goals')
            .update(data)
            .eq('id', id);

        if (error) {
            toast.error('Failed to update goal');
            throw error;
        }
        toast.success('Goal updated successfully!');
    },

    async deleteGoal(id: string) {
        const { error } = await supabase
            .from('savings_goals')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Failed to delete goal');
            throw error;
        }
        toast.success('Goal deleted');
    },

    async addDeposit(userId: string, goalId: string, amount: number, currency: string) {
        // Atomic RPC: inserts the deposit and updates goal.current_amount in a single
        // transaction so concurrent deposits (double-tap, two tabs) can't race.
        const { data, error } = await supabase.rpc('add_savings_deposit_atomic', {
            p_goal_id: goalId,
            p_user_id: userId,
            p_amount: amount,
            p_currency: currency,
        });

        if (error || (data && (data as { success?: boolean }).success === false)) {
            toast.error('Failed to add deposit');
            throw error ?? new Error((data as { error?: string })?.error || 'Failed to add deposit');
        }

        toast.success('Deposit added successfully!');
    },

    async getDepositsForGoals(userId: string, goalIds: string[], sinceDays = 90): Promise<SavingsDeposit[]> {
        if (!goalIds.length) return [];
        const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('savings_deposits')
            .select(DEPOSIT_SELECT)
            .eq('user_id', userId)
            .in('goal_id', goalIds)
            .gte('created_at', since)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching deposits:', error);
            return [];
        }
        return (data ?? []) as SavingsDeposit[];
    },

    async getAllDepositsForGoal(userId: string, goalId: string): Promise<SavingsDeposit[]> {
        const { data, error } = await supabase
            .from('savings_deposits')
            .select(DEPOSIT_SELECT)
            .eq('user_id', userId)
            .eq('goal_id', goalId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching deposits:', error);
            return [];
        }
        return (data ?? []) as SavingsDeposit[];
    },

    async removeDeposit(userId: string, depositId: string) {
        const { data, error } = await supabase.rpc('remove_savings_deposit_atomic', {
            p_deposit_id: depositId,
            p_user_id: userId,
        });
        if (error || (data && (data as { success?: boolean }).success === false)) {
            const msg = (data as { error?: string })?.error;
            toast.error(msg || 'Failed to remove deposit');
            throw error ?? new Error(msg || 'Failed to remove deposit');
        }
        toast.success('Deposit removed');
    },
};
