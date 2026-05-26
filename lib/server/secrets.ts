import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison for shared secrets passed via HTTP headers.
 * Returns false if either side is missing or the lengths differ; otherwise
 * delegates to `timingSafeEqual` so the compare doesn't leak the secret via
 * timing side channels.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}
