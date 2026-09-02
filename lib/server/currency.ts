import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', CHF: 'Fr', SGD: 'S$', VND: '₫',
    TWD: 'NT$', JPY: '¥', KRW: '₩', HKD: 'HK$', MYR: 'RM',
    PHP: '₱', THB: '฿', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', IDR: 'Rp', AED: 'AED',
    CNY: 'CN¥', RUB: '₽', ZAR: 'R', TRY: '₺', NZD: 'NZ$', SEK: 'kr'
};

// Currencies conventionally shown without minor units. Mirrors the client-side
// list in user-preferences-provider.tsx so push copy matches the in-app numbers.
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'IDR', 'JPY', 'KRW', 'INR', 'TWD', 'THB', 'PHP']);

export function currencySymbol(ccy: string): string {
    const code = ccy.toUpperCase();
    return CURRENCY_SYMBOLS[code] || code;
}

export function fmtMoney(amount: number, ccy: string): string {
    const code = ccy.toUpperCase();
    const digits = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(Math.abs(amount));
    // Minus belongs before the unit ("-$100", not "$-100").
    return `${amount < 0 ? '-' : ''}${currencySymbol(code)}${formatted}`;
}

/**
 * The base currency anything server-side must be denominated in. Read from the
 * profile rather than taken from a request body: a client sends whatever its
 * preferences provider currently holds, and on a cold mount that is still the
 * hardcoded default — long enough for a whole recap or snapshot to be built,
 * and converted, against the wrong currency.
 */
export async function profileCurrency(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data, error } = await supabase
        .from('profiles')
        .select('currency')
        .eq('id', userId)
        .maybeSingle();
    // Throws rather than defaulting: a failed lookup that quietly answers "USD"
    // is the same defect this function exists to remove, except it would also
    // persist its answer. Callers decide what to do with the uncertainty.
    if (error) throw new Error(`profile currency lookup failed: ${error.message}`);
    return ((data?.currency as string | null) || 'USD').toUpperCase();
}
