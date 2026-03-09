import { supabase } from '@/lib/supabase';
import { SavingsGoal, SavingsDeposit } from '@/types/goal';
import { toast } from '@/utils/haptics';

export const GoalService = {
    async getGoals(userId: string, workspaceId?: string | null) {
        let query = supabase
            .from('savings_goals')
            .select('*')
            .order('created_at', { ascending: false });

        if (workspaceId && workspaceId !== 'personal') {
            query = query.eq('group_id', workspaceId);
        } else if (workspaceId === 'personal') {
            query = query.is('group_id', null);
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
            .select()
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
        // Insert deposit
        const { error: depositError } = await supabase
            .from('savings_deposits')
            .insert({
                goal_id: goalId,
                user_id: userId,
                amount: amount,
                currency: currency
            });

        if (depositError) {
            toast.error('Failed to add deposit');
            throw depositError;
        }

        // The current_amount update could be handled by a DB trigger, 
        // but since the original code did it manually, I'll keep it for now 
        // but ideally it should be atomic or server-side.
        // For now, let's keep the client-side logic but centralized.
        
        // Fetch current amount first to be safe, or use RPC
        const { data: goal } = await supabase.from('savings_goals').select('current_amount').eq('id', goalId).single();
        if (goal) {
             const { error: updateError } = await supabase
                .from('savings_goals')
                .update({ current_amount: Number(goal.current_amount) + amount })
                .eq('id', goalId);
                
             if (updateError) {
                 toast.error('Failed to update goal total');
                 throw updateError;
             }
        }

        toast.success('Deposit added successfully!');
    }
};
