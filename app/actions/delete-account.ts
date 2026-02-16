import { z } from 'zod';

const DeleteAccountSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password is required"),
});

export async function deleteAccount(email: string, password: string) {
    const result = DeleteAccountSchema.safeParse({ email, password });

    if (!result.success) {
        return { error: 'Invalid input data' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceRoleKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return { error: 'Server configuration error' };
    }

    try {
        // 1. Verify credentials by attempting to sign in
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: signInError } = await authClient.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError || !user) {
            return { error: 'Invalid password' };
        }

        // 2. Initialize admin client for deletion
        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 3. Prepare data for deletion (RPC)
        const { error: rpcError } = await adminClient.rpc('prepare_delete_account', {
            p_user_id: user.id
        });

        if (rpcError) {
            console.error('Error preparing account deletion:', rpcError);
            return { error: 'Failed to clean up user data. Please try again.' };
        }

        // 4. Delete the user from auth.users
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error('Error deleting user:', deleteError);
            return { error: 'Failed to delete user account. Please contact support.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error during account deletion:', error);
        return { error: 'An unexpected error occurred' };
    }
}
