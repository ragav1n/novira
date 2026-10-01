import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitConfig {
    max: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterSec: number;
}

// In-memory sliding-window limiter, segregated by bucket name so different
// routes don't share state. Vercel cold starts will occasionally reset this,
// which is fine for soft abuse prevention at our scale.
const buckets = new Map<string, Map<string, number[]>>();

export function checkRateLimit(bucket: string, key: string, cfg: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const cutoff = now - cfg.windowMs;
    let bucketMap = buckets.get(bucket);
    if (!bucketMap) {
        bucketMap = new Map();
        buckets.set(bucket, bucketMap);
    }
    const recent = (bucketMap.get(key) || []).filter(ts => ts > cutoff);
    if (recent.length >= cfg.max) {
        bucketMap.set(key, recent);
        const resetAt = recent[0] + cfg.windowMs;
        return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        };
    }
    recent.push(now);
    bucketMap.set(key, recent);
    return {
        allowed: true,
        remaining: cfg.max - recent.length,
        resetAt: now + cfg.windowMs,
        retryAfterSec: 0,
    };
}

let serviceClient: SupabaseClient | null | undefined;
function getServiceClient(): SupabaseClient | null {
    if (serviceClient !== undefined) return serviceClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    serviceClient = url && key
        ? createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
        : null;
    return serviceClient;
}

// Database-backed fixed-window limiter for the routes that spend money (AI calls).
// The in-memory one above is per serverless instance, so a cold start or a second
// instance hands out a fresh quota. Falls back to the in-memory limiter when the
// database can't answer (migration not applied, no service key, outage): a
// per-instance cap is still a cap, and failing closed would take recap, chat and
// scan down together with the counter.
export async function checkDurableRateLimit(bucket: string, key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
    const supabase = getServiceClient();
    if (supabase) {
        const { data, error } = await supabase.rpc('rate_limit_hit', {
            p_bucket: bucket,
            p_key: key,
            p_window_ms: cfg.windowMs,
            p_max: cfg.max,
        });
        const row = Array.isArray(data) ? data[0] as { hit_count: number; window_started: string } | undefined : undefined;
        if (!error && row) {
            const now = Date.now();
            const resetAt = new Date(row.window_started).getTime() + cfg.windowMs;
            const allowed = row.hit_count <= cfg.max;
            return {
                allowed,
                remaining: Math.max(0, cfg.max - row.hit_count),
                resetAt,
                retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
            };
        }
        console.error('[rate-limit] durable counter unavailable, using in-memory', error ?? 'no row');
    }
    return checkRateLimit(bucket, key, cfg);
}

export function rateLimitResponse(result: RateLimitResult, cfg: RateLimitConfig, message?: string): NextResponse {
    return NextResponse.json(
        { error: message || 'Rate limit exceeded', retryAfterSec: result.retryAfterSec, resetAt: result.resetAt },
        {
            status: 429,
            headers: {
                'Retry-After': String(result.retryAfterSec),
                'X-RateLimit-Limit': String(cfg.max),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(result.resetAt),
            },
        },
    );
}

// Drop empty per-key arrays so the maps don't grow unbounded across stable users.
setInterval(() => {
    const now = Date.now();
    for (const [, bucketMap] of buckets) {
        for (const [key, timestamps] of bucketMap) {
            const recent = timestamps.filter(ts => ts > now - 24 * 60 * 60 * 1000);
            if (recent.length === 0) bucketMap.delete(key);
            else if (recent.length !== timestamps.length) bucketMap.set(key, recent);
        }
    }
}, 60_000).unref?.();
