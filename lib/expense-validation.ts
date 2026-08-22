/**
 * Pure validation for the add-expense form. Lives outside the submission hook so
 * it can be tested without pulling in the Supabase client.
 */

export type ExpenseFormErrors = {
    amount?: string;
    description?: string;
    date?: string;
};

// Callers pass the *evaluated* amount, so by this point anything that is not a
// plain number is something the calculator could not resolve. Validating with an
// allowlist rather than parseFloat matters: parseFloat happily accepts a numeric
// prefix, so "1,234" used to save as 1 and "12+" as 12 — silently, with a success
// toast. A denylist of operator characters would not have caught "1,234" either.
const PLAIN_NUMBER = /^\d*\.?\d+$/;

export function getExpenseFormErrors(
    amount: string,
    description: string,
    date: Date | undefined,
): ExpenseFormErrors | null {
    const errors: ExpenseFormErrors = {};
    const raw = (amount ?? '').trim();
    const parsed = parseFloat(raw);
    if (!raw) errors.amount = 'Amount is required';
    else if (!PLAIN_NUMBER.test(raw)) {
        errors.amount = /[+\-*/()]/.test(raw)
            ? "That calculation isn't finished — tap = to work it out"
            : 'Amount must be a plain number, like 51.72';
    }
    else if (parsed <= 0) errors.amount = 'Amount must be greater than 0';
    else if (parsed > 999_999_999) errors.amount = 'Amount is too large';

    const trimmed = description?.trim();
    if (!trimmed) errors.description = 'Description is required';
    else if (trimmed.length > 300) errors.description = 'Description is too long (max 300 chars)';
    if (!date) errors.date = 'Date is required';

    return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * parseFloat accepts a numeric prefix, so it reads "1,234" as 1. Anywhere a
 * user-typed money string becomes a number, it has to go through this instead.
 */
export function parseAmountStrict(value: string): number | null {
    const raw = (value ?? '').trim();
    if (!PLAIN_NUMBER.test(raw)) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * Money has to be compared in integer cents. In binary floating point
 * 1.1 + 2.2 is 3.3000000000000003, so an exactly-balanced custom split of 3.30
 * into 1.10 and 2.20 compared as "exceeding the total" and refused to save.
 */
export function toCents(value: number): number {
    return Math.round(value * 100);
}
