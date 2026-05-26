import 'server-only';
import { NextResponse } from 'next/server';

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
