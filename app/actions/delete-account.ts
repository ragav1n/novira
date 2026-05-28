'use server';

import { z } from 'zod';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

const DeleteAccountSchema = z.object({
    email: z.string().email(),
});

export async function deleteAccount(email: string) {
    const result = DeleteAccountSchema.safeParse({ email });

    if (!result.success) {
        return { error: 'Invalid input data' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceRoleKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return { error: 'Server configuration error' };
    }

    try {
        // 1. Verify current session and email match
        // This is a critical security check to ensure users can only delete their own accounts
        const supabase = await createClient();
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

        if (userError || !currentUser || currentUser.email !== email) {
            return { error: 'Unauthorized: You can only delete your own account' };
        }

        const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 2. Prepare data for deletion (RPC)
        const { error: rpcError } = await adminClient.rpc('prepare_delete_account', {
            p_user_id: currentUser.id
        });

        if (rpcError) {
            console.error('Error preparing account deletion:', rpcError);
            return { error: 'Failed to clean up user data. Please try again.' };
        }

        // 3. Purge storage files. Best-effort: we log and continue if listing
        // or removal fails — the auth row still needs to come down, and a
        // stuck storage bucket shouldn't block account deletion.
        const LIST_LIMIT = 1000;

        // 3a. Receipts — path convention `${userId}/${txId}.${ext}`,
        // one folder per user.
        const receiptPaths: string[] = [];
        let receiptOffset = 0;
        while (true) {
            const { data: files, error: listError } = await adminClient
                .storage
                .from('receipts')
                .list(currentUser.id, { limit: LIST_LIMIT, offset: receiptOffset });
            if (listError) {
                console.error('Error listing receipt files for deletion:', listError);
                break;
            }
            if (!files || files.length === 0) break;
            for (const f of files) {
                if (f.id) receiptPaths.push(`${currentUser.id}/${f.name}`);
            }
            if (files.length < LIST_LIMIT) break;
            receiptOffset += LIST_LIMIT;
        }
        if (receiptPaths.length > 0) {
            const { error: removeError } = await adminClient
                .storage
                .from('receipts')
                .remove(receiptPaths);
            if (removeError) {
                console.error('Error removing receipt files:', removeError);
            }
        }

        // 3b. Avatars — flat path `${userId}-${random}.${ext}` at the bucket
        // root. We narrow with `search` and confirm the prefix client-side so
        // we never touch another user's files even if `search` matches loosely.
        const avatarPaths: string[] = [];
        let avatarOffset = 0;
        while (true) {
            const { data: files, error: listError } = await adminClient
                .storage
                .from('avatars')
                .list('', {
                    limit: LIST_LIMIT,
                    offset: avatarOffset,
                    search: currentUser.id,
                });
            if (listError) {
                console.error('Error listing avatar files for deletion:', listError);
                break;
            }
            if (!files || files.length === 0) break;
            for (const f of files) {
                if (f.id && f.name.startsWith(`${currentUser.id}-`)) {
                    avatarPaths.push(f.name);
                }
            }
            if (files.length < LIST_LIMIT) break;
            avatarOffset += LIST_LIMIT;
        }
        if (avatarPaths.length > 0) {
            const { error: removeError } = await adminClient
                .storage
                .from('avatars')
                .remove(avatarPaths);
            if (removeError) {
                console.error('Error removing avatar files:', removeError);
            }
        }

        // 4. Delete the user from auth.users using admin privileges
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(currentUser.id);

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
