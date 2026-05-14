/**
 * Read the message off a value thrown into a catch block. Use after `catch (error)`
 * (which is `unknown` under strict mode) so we don't sprinkle `(error: any)` everywhere.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const msg = (error as { message: unknown }).message;
        if (typeof msg === 'string') return msg;
    }
    return fallback;
}

/**
 * Read the .name property off an unknown error — used to detect specific
 * thrown classes like `AbortError` or `QueueFullError` without type-asserting.
 */
export function getErrorName(error: unknown): string | undefined {
    if (error instanceof Error) return error.name;
    if (typeof error === 'object' && error !== null && 'name' in error) {
        const n = (error as { name: unknown }).name;
        if (typeof n === 'string') return n;
    }
    return undefined;
}
