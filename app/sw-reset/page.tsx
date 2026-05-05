'use client';

import { useState } from 'react';
import { Wrench, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Stage = 'confirm' | 'running' | 'done' | 'error';

async function clearIndexedDB() {
    if (!('indexedDB' in window)) return;
    try {
        const anyIDB = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
        if (typeof anyIDB.databases === 'function') {
            const dbs = await anyIDB.databases();
            await Promise.all(
                dbs.map(d => d.name ? new Promise<void>((res) => {
                    const req = indexedDB.deleteDatabase(d.name as string);
                    req.onsuccess = () => res();
                    req.onerror = () => res();
                    req.onblocked = () => res();
                }) : Promise.resolve())
            );
        } else {
            // Fallback: known store names this app uses.
            for (const name of ['keyval-store', 'novira-offline-queue']) {
                await new Promise<void>((res) => {
                    const req = indexedDB.deleteDatabase(name);
                    req.onsuccess = () => res();
                    req.onerror = () => res();
                    req.onblocked = () => res();
                });
            }
        }
    } catch (e) {
        console.warn('[sw-reset] IDB clear failed', e);
    }
}

export default function SWResetPage() {
    const [stage, setStage] = useState<Stage>('confirm');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const runReset = async () => {
        setStage('running');
        try {
            // Sign out first so the server invalidates the session before we
            // wipe local tokens.
            try { await supabase.auth.signOut(); } catch (e) { console.warn('[sw-reset] signOut', e); }

            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            await clearIndexedDB();
            try { sessionStorage.clear(); } catch { /* ignore */ }
            try { localStorage.clear(); } catch { /* ignore */ }

            setStage('done');
            // Brief pause so the user can see the success state before redirect.
            setTimeout(() => { window.location.replace('/'); }, 800);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setErrorMsg(msg);
            setStage('error');
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
            {stage === 'confirm' && (
                <div className="max-w-sm w-full space-y-5 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-lg font-semibold">Reset App?</h1>
                        <p className="text-sm text-muted-foreground">
                            This clears cached data, the offline sync queue, and signs you out on this device.
                            Your account and synced transactions are unaffected.
                        </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => window.history.length > 1 ? window.history.back() : window.location.replace('/')}
                            className="flex-1 h-11 rounded-xl bg-secondary/20 hover:bg-secondary/30 text-sm font-medium border border-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={runReset}
                            className="flex-1 h-11 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-bold border border-amber-500/30 transition-colors"
                        >
                            Reset App
                        </button>
                    </div>
                </div>
            )}

            {stage === 'running' && (
                <>
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Resetting app…</p>
                </>
            )}

            {stage === 'done' && (
                <>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Done — reloading</p>
                </>
            )}

            {stage === 'error' && (
                <div className="max-w-sm w-full space-y-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-base font-semibold">Reset failed</h1>
                        <p className="text-xs text-muted-foreground break-words">{errorMsg}</p>
                    </div>
                    <button
                        onClick={() => window.location.replace('/')}
                        className="w-full h-11 rounded-xl bg-secondary/20 hover:bg-secondary/30 text-sm font-medium border border-white/5 transition-colors"
                    >
                        Back to app
                    </button>
                </div>
            )}
        </div>
    );
}
