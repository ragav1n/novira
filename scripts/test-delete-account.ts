// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Helper to load env
function loadEnv() {
    try {
        let envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) {
            envPath = path.resolve(__dirname, '../.env');
        }

        if (!fs.existsSync(envPath)) {
            console.warn('No .env or .env.local found');
            return {};
        }

        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        });
        return envVars;
    } catch (e) {
        console.error('Error loading env', e);
        return {};
    }
}

async function testDeleteAccount() {
    const env = loadEnv();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('Missing env vars');
        return;
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const authClient = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Create a test user
    const email = `test-del-${Date.now()}@example.com`;
    const password = 'password123';

    console.log(`Creating test user: ${email}`);
    const { data: { user }, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (createError || !user) {
        console.error('Failed to create user:', createError);
        return;
    }

    console.log(`User created: ${user.id}`);

    // 2. Add some data
    console.log('Inserting test transaction...');
    // We need to wait a bit for trigger to create profile potentially, or just create it
    // Actually admin create user should trigger it if it listens to auth.users insert.

    // Let's rely on RPC to clean everything.
    const { error: txError } = await adminClient.from('transactions').insert({
        user_id: user.id,
        amount: 100,
        description: 'Test Transaction',
        category: 'Food',
        date: new Date().toISOString()
    });

    if (txError) {
        console.error('Failed to insert transaction:', txError);
    } else {
        console.log('Transaction inserted');
    }

    // 3. Simulate deleteAccount logic
    console.log('Simulating deleteAccount action...');

    // 3.1 Verify credentials (signIn)
    const { data: { user: signedInUser }, error: signInError } = await authClient.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError || !signedInUser) {
        console.error('SignIn verification failed:', signInError);
        return;
    }
    console.log('Credentials verified');

    // 3.2 Prepare delete (RPC)
    console.log('Calling prepare_delete_account RPC...');
    const { error: rpcError } = await adminClient.rpc('prepare_delete_account', {
        p_user_id: user.id
    });

    if (rpcError) {
        console.error('RPC failed:', rpcError);
        return;
    }
    console.log('RPC successful - Data cleaned up');

    // 3.3 Delete user
    console.log('Deleting user from auth.users...');
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
        console.error('Delete user failed:', deleteError);
        return;
    }
    console.log('User deleted successfully');

    // 4. Verify
    const { data: userCheck, error: checkError } = await adminClient.auth.admin.getUserById(user.id);
    if (!userCheck || (checkError && checkError.message.includes('User not found'))) {
        console.log('VERIFICATION PASSED: User is gone.');
    } else {
        console.error('VERIFICATION FAILED: User still exists.');
    }
}

testDeleteAccount();
