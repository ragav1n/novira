// Deterministic (no-AI) parser that turns a dictated transcript into structured
// expense fields. The Web Speech API hands us a plain-text transcript; because
// the expense field-set is small and closed (13 categories, 5 payment methods,
// ~26 currencies) a keyword/pattern parser is enough to route the pieces.
//
// The parser is conservative: every field is null/empty unless confidently
// detected — it never guesses. Anything not recognised stays in `description`.

import { autoCategorize, CATEGORIES } from './categories';

export type VoicePaymentMethod = 'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer';

export interface ParsedVoiceExpense {
    amount: string | null;
    currency: string | null;
    category: string | null;
    paymentMethod: VoicePaymentMethod | null;
    tags: string[];
    notes: string | null;
    // Raw place phrase spoken after an "at"/"location" anchor — still needs
    // geocoding to become real coordinates. Null when no location was dictated.
    location: string | null;
    description: string;
    raw: string;
}

const NUMBER_WORDS: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90,
};

// Currency token-sequences, longest first so "hong kong dollar" wins over "dollar".
const CURRENCY_SEQUENCES: { seq: string[]; code: string }[] = [
    { seq: ['hong', 'kong', 'dollars'], code: 'HKD' },
    { seq: ['hong', 'kong', 'dollar'], code: 'HKD' },
    { seq: ['new', 'zealand', 'dollars'], code: 'NZD' },
    { seq: ['new', 'zealand', 'dollar'], code: 'NZD' },
    { seq: ['south', 'african', 'rand'], code: 'ZAR' },
    { seq: ['turkish', 'lira'], code: 'TRY' },
    { seq: ['turkish', 'liras'], code: 'TRY' },
    { seq: ['russian', 'rubles'], code: 'RUB' },
    { seq: ['russian', 'ruble'], code: 'RUB' },
    { seq: ['chinese', 'yuan'], code: 'CNY' },
    { seq: ['swedish', 'krona'], code: 'SEK' },
    { seq: ['swedish', 'kronor'], code: 'SEK' },
    { seq: ['canadian', 'dollars'], code: 'CAD' },
    { seq: ['canadian', 'dollar'], code: 'CAD' },
    { seq: ['australian', 'dollars'], code: 'AUD' },
    { seq: ['australian', 'dollar'], code: 'AUD' },
    { seq: ['aussie', 'dollars'], code: 'AUD' },
    { seq: ['aussie', 'dollar'], code: 'AUD' },
    { seq: ['kiwi', 'dollars'], code: 'NZD' },
    { seq: ['kiwi', 'dollar'], code: 'NZD' },
    { seq: ['singapore', 'dollars'], code: 'SGD' },
    { seq: ['singapore', 'dollar'], code: 'SGD' },
    { seq: ['taiwan', 'dollars'], code: 'TWD' },
    { seq: ['taiwan', 'dollar'], code: 'TWD' },
    { seq: ['us', 'dollars'], code: 'USD' },
    { seq: ['us', 'dollar'], code: 'USD' },
    { seq: ['mexican', 'pesos'], code: 'MXN' },
    { seq: ['mexican', 'peso'], code: 'MXN' },
    { seq: ['philippine', 'pesos'], code: 'PHP' },
    { seq: ['philippine', 'peso'], code: 'PHP' },
    { seq: ['brazilian', 'real'], code: 'BRL' },
    { seq: ['brazilian', 'reais'], code: 'BRL' },
    { seq: ['vietnamese', 'dong'], code: 'VND' },
    // Single-word forms
    { seq: ['dollars'], code: 'USD' }, { seq: ['dollar'], code: 'USD' },
    { seq: ['bucks'], code: 'USD' }, { seq: ['buck'], code: 'USD' }, { seq: ['usd'], code: 'USD' },
    { seq: ['euros'], code: 'EUR' }, { seq: ['euro'], code: 'EUR' }, { seq: ['eur'], code: 'EUR' },
    { seq: ['rupees'], code: 'INR' }, { seq: ['rupee'], code: 'INR' }, { seq: ['inr'], code: 'INR' },
    { seq: ['pounds'], code: 'GBP' }, { seq: ['pound'], code: 'GBP' }, { seq: ['quid'], code: 'GBP' }, { seq: ['gbp'], code: 'GBP' },
    { seq: ['francs'], code: 'CHF' }, { seq: ['franc'], code: 'CHF' }, { seq: ['chf'], code: 'CHF' },
    { seq: ['yen'], code: 'JPY' }, { seq: ['jpy'], code: 'JPY' },
    { seq: ['won'], code: 'KRW' }, { seq: ['krw'], code: 'KRW' },
    { seq: ['dong'], code: 'VND' }, { seq: ['vnd'], code: 'VND' },
    { seq: ['ringgit'], code: 'MYR' }, { seq: ['myr'], code: 'MYR' },
    { seq: ['baht'], code: 'THB' }, { seq: ['thb'], code: 'THB' },
    { seq: ['rupiah'], code: 'IDR' }, { seq: ['idr'], code: 'IDR' },
    { seq: ['dirhams'], code: 'AED' }, { seq: ['dirham'], code: 'AED' }, { seq: ['aed'], code: 'AED' },
    { seq: ['php'], code: 'PHP' }, { seq: ['twd'], code: 'TWD' }, { seq: ['sgd'], code: 'SGD' },
    { seq: ['hkd'], code: 'HKD' }, { seq: ['cad'], code: 'CAD' }, { seq: ['aud'], code: 'AUD' },
    { seq: ['mxn'], code: 'MXN' }, { seq: ['brl'], code: 'BRL' },
    { seq: ['yuan'], code: 'CNY' }, { seq: ['cny'], code: 'CNY' }, { seq: ['rmb'], code: 'CNY' },
    { seq: ['rubles'], code: 'RUB' }, { seq: ['ruble'], code: 'RUB' }, { seq: ['rub'], code: 'RUB' },
    { seq: ['rand'], code: 'ZAR' }, { seq: ['zar'], code: 'ZAR' },
    { seq: ['lira'], code: 'TRY' }, { seq: ['liras'], code: 'TRY' }, { seq: ['try'], code: 'TRY' },
    { seq: ['nzd'], code: 'NZD' },
    { seq: ['krona'], code: 'SEK' }, { seq: ['kronor'], code: 'SEK' }, { seq: ['sek'], code: 'SEK' },
];

const SYMBOL_CURRENCY: Record<string, string> = {
    '$': 'USD', '€': 'EUR', '₹': 'INR', '£': 'GBP', '¥': 'JPY',
    '₫': 'VND', '₩': 'KRW', '฿': 'THB', '₱': 'PHP',
};

// Payment-method token-sequences, longest/most-specific first.
const PAYMENT_SEQUENCES: { seq: string[]; pm: VoicePaymentMethod }[] = [
    { seq: ['credit', 'card'], pm: 'Credit Card' },
    { seq: ['debit', 'card'], pm: 'Debit Card' },
    { seq: ['bank', 'transfer'], pm: 'Bank Transfer' },
    { seq: ['net', 'banking'], pm: 'Bank Transfer' },
    { seq: ['google', 'pay'], pm: 'UPI' },
    { seq: ['upi'], pm: 'UPI' }, { seq: ['gpay'], pm: 'UPI' },
    { seq: ['paytm'], pm: 'UPI' }, { seq: ['phonepe'], pm: 'UPI' },
    { seq: ['credit'], pm: 'Credit Card' },
    { seq: ['debit'], pm: 'Debit Card' },
    { seq: ['cash'], pm: 'Cash' },
];

// Filler words consumed when directly before an amount, so the description
// doesn't keep "spent" / "for" / "about" hanging around.
const AMOUNT_FILLER = new Set(['for', 'amount', 'spent', 'spend', 'cost', 'costs', 'of', 'is', 'was', 'paid', 'pay', 'about', 'around', 'roughly']);
// Filler words consumed when directly before a payment method ("paid with …").
const PAYMENT_FILLER = new Set(['paid', 'with', 'using', 'used', 'by', 'via', 'on', 'in']);
// Connector words trimmed off the ends of the leftover description.
const EDGE_STOPWORDS = new Set(['and', 'for', 'of', 'with', 'at', 'the', 'a', 'an', 'on', 'to', 'paid', 'spent', 'i', 'it', 'was', 'is', 'about', 'in']);
// Words that end an open-ended location capture — other field anchors plus
// sentence connectors that a place name almost never spans.
const LOCATION_STOP = new Set([
    'tag', 'tagged', 'hashtag', 'note', 'notes', 'category', 'description', 'desc',
    'location', 'at', 'for', 'and', 'with', 'to', 'paid',
]);

const MAX_TAGS = 12;
const MAX_TAG_LEN = 32;

// Mirror of the tag normalisation in components/add-expense/tags-section.tsx.
function normalizeTag(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, MAX_TAG_LEN);
}

// Strips a digit token like "$42", "1,250", "42.50." → numeric value, plus any
// currency implied by an attached symbol.
function parseDigitToken(tok: string): { value: number; currency: string | null } | null {
    let currency: string | null = null;
    for (const [sym, code] of Object.entries(SYMBOL_CURRENCY)) {
        if (tok.includes(sym)) { currency = code; break; }
    }
    const stripped = tok.replace(/^[^\d]+/, '').replace(/[^\d.]+$/, '').replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(stripped)) return null;
    const n = Number(stripped);
    if (!Number.isFinite(n)) return null;
    return { value: n, currency };
}

// Parses a run of spelled-out number words starting at index `i`.
// e.g. ["forty","two"] → 42, ["five","point","five"] → 5.5
function parseSpelledNumber(words: string[], i: number): { value: number; end: number } | null {
    let total = 0;
    let current = 0;
    let used = 0;
    let hasAny = false;
    let decimalMode = false;
    let decimalStr = '';
    for (let k = i; k < words.length; k++) {
        const w = words[k];
        if (w === 'point' || w === 'dot') {
            if (!hasAny) return null;
            decimalMode = true;
            used++;
            continue;
        }
        if (decimalMode) {
            if (w in NUMBER_WORDS && NUMBER_WORDS[w] < 10) {
                decimalStr += String(NUMBER_WORDS[w]);
                used++;
                continue;
            }
            break;
        }
        if (w in NUMBER_WORDS) {
            current += NUMBER_WORDS[w];
            used++;
            hasAny = true;
            continue;
        }
        if (w === 'hundred') {
            current = (current || 1) * 100;
            used++;
            hasAny = true;
            continue;
        }
        if (w === 'thousand') {
            total += (current || 1) * 1000;
            current = 0;
            used++;
            hasAny = true;
            continue;
        }
        if (w === 'and' && hasAny) {
            const nx = words[k + 1];
            if (nx && (nx in NUMBER_WORDS || nx === 'hundred' || nx === 'thousand')) {
                used++;
                continue;
            }
            break;
        }
        break;
    }
    if (!hasAny) return null;
    let value = total + current;
    if (decimalStr) value += Number('0.' + decimalStr);
    return { value, end: i + used };
}

// True if tokens starting at `i` match `seq` exactly.
function matchesSeq(words: string[], i: number, seq: string[]): boolean {
    if (i + seq.length > words.length) return false;
    for (let k = 0; k < seq.length; k++) {
        if (words[i + k] !== seq[k]) return false;
    }
    return true;
}

const CATEGORY_IDS: Set<string> = new Set(CATEGORIES.map(c => c.id));

export function parseVoiceExpense(transcript: string): ParsedVoiceExpense {
    const raw = (transcript || '').trim();
    const empty: ParsedVoiceExpense = {
        amount: null, currency: null, category: null, paymentMethod: null,
        tags: [], notes: null, location: null, description: '', raw,
    };
    if (!raw) return empty;

    const original = raw.split(/\s+/);
    // Lowercased, punctuation-stripped tokens used for all matching. A dot is kept
    // only between digits so decimal amounts survive but "cash." matches "cash".
    const w = original.map(t =>
        t.toLowerCase()
            .replace(/[^\p{L}\p{N}$€₹£¥₫₩฿₱.]/gu, '')
            .replace(/\.(?!\d)/g, '')
            .replace(/(?<!\d)\./g, ''),
    );
    const consumed = new Set<number>();

    // --- Numbers (digit tokens + spelled-out runs) ---
    const numbers: { value: number; start: number; end: number; currency: string | null }[] = [];
    {
        let k = 0;
        while (k < w.length) {
            const digit = parseDigitToken(w[k]);
            if (digit) {
                numbers.push({ value: digit.value, start: k, end: k + 1, currency: digit.currency });
                k++;
                continue;
            }
            const spelled = parseSpelledNumber(w, k);
            if (spelled && spelled.end > k) {
                numbers.push({ value: spelled.value, start: k, end: spelled.end, currency: null });
                k = spelled.end;
                continue;
            }
            k++;
        }
    }

    // --- Currency (word sequences) ---
    let currency: string | null = null;
    let currencyStart = -1;
    let currencyEnd = -1;
    for (let i = 0; i < w.length && currency === null; i++) {
        for (const { seq, code } of CURRENCY_SEQUENCES) {
            if (matchesSeq(w, i, seq)) {
                currency = code;
                currencyStart = i;
                currencyEnd = i + seq.length;
                break;
            }
        }
    }
    // Fall back to a symbol glued onto a digit token (e.g. "$42").
    if (currency === null) {
        const symboled = numbers.find(n => n.currency);
        if (symboled) currency = symboled.currency;
    }

    // --- Amount ---
    let amountValue: number | null = null;
    const amountTokens = new Set<number>();
    if (numbers.length > 0) {
        let chosen = numbers[0];
        if (currencyStart >= 0) {
            const before = numbers.find(n => n.end === currencyStart);
            const after = numbers.find(n => n.start === currencyEnd);
            if (before) chosen = before;
            else if (after) chosen = after;
        }
        if (chosen === numbers[0] && numbers.length > 1) {
            // No currency adjacency — prefer a number right after an amount-anchor.
            const anchored = numbers.find(n => n.start > 0 && AMOUNT_FILLER.has(w[n.start - 1]));
            if (anchored) chosen = anchored;
        }
        amountValue = chosen.value;
        for (let t = chosen.start; t < chosen.end; t++) amountTokens.add(t);

        // Cents: "forty two dollars fifty" or an explicit "… cents".
        const centsIdx = w.findIndex(t => t === 'cents' || t === 'cent');
        if (centsIdx >= 0) {
            const centsNum = numbers.find(n => n.end === centsIdx && n !== chosen);
            if (centsNum && centsNum.value >= 1 && centsNum.value < 100 && Number.isInteger(centsNum.value)) {
                amountValue = Math.floor(chosen.value) + centsNum.value / 100;
                for (let t = centsNum.start; t < centsNum.end; t++) amountTokens.add(t);
                consumed.add(centsIdx);
            }
        } else if (currencyStart >= 0 && chosen.end === currencyStart) {
            const afterNum = numbers.find(n => n.start === currencyEnd);
            if (afterNum && afterNum.value >= 1 && afterNum.value < 100 && Number.isInteger(afterNum.value)) {
                amountValue = Math.floor(chosen.value) + afterNum.value / 100;
                for (let t = afterNum.start; t < afterNum.end; t++) amountTokens.add(t);
            }
        }
    }
    if (amountValue !== null && amountValue >= 0) {
        const min = Math.min(...amountTokens);
        amountTokens.forEach(t => consumed.add(t));
        // Drop a single filler word ("for", "spent" …) sitting before the amount.
        if (min > 0 && AMOUNT_FILLER.has(w[min - 1])) consumed.add(min - 1);
    } else {
        amountValue = null;
    }

    // Mark the currency words as consumed.
    if (currencyStart >= 0) {
        for (let t = currencyStart; t < currencyEnd; t++) consumed.add(t);
    }

    // --- Payment method ---
    let paymentMethod: VoicePaymentMethod | null = null;
    for (let i = 0; i < w.length && paymentMethod === null; i++) {
        for (const { seq, pm } of PAYMENT_SEQUENCES) {
            if (matchesSeq(w, i, seq)) {
                paymentMethod = pm;
                for (let t = i; t < i + seq.length; t++) consumed.add(t);
                // Drop "paid with" / "using" filler immediately before it.
                let p = i - 1;
                while (p >= 0 && PAYMENT_FILLER.has(w[p])) {
                    consumed.add(p);
                    p--;
                }
                break;
            }
        }
    }

    // --- Notes ("note …" captures the rest of the utterance) ---
    let notes: string | null = null;
    {
        const noteIdx = w.findIndex(t => t === 'note' || t === 'notes');
        if (noteIdx >= 0 && noteIdx + 1 < original.length) {
            notes = original.slice(noteIdx + 1).join(' ').trim() || null;
            if (notes) {
                for (let t = noteIdx; t < original.length; t++) consumed.add(t);
            }
        }
    }

    // --- Tags ("tag X" / "tagged X" / "hashtag X" — one word each) ---
    const tags: string[] = [];
    for (let i = 0; i < w.length; i++) {
        if (consumed.has(i)) continue;
        if (w[i] === 'tag' || w[i] === 'tagged' || w[i] === 'hashtag') {
            const next = i + 1;
            if (next < w.length && !consumed.has(next)) {
                const tag = normalizeTag(original[next]);
                if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) {
                    tags.push(tag);
                    consumed.add(i);
                    consumed.add(next);
                }
            }
        }
    }

    // --- Category (explicit "category X" first, else keyword auto-detect) ---
    let category: string | null = null;
    {
        const catIdx = w.findIndex(t => t === 'category');
        if (catIdx >= 0 && catIdx + 1 < w.length) {
            const candidate = w[catIdx + 1];
            const matched = CATEGORY_IDS.has(candidate)
                ? candidate
                : CATEGORIES.find(c => c.label.toLowerCase() === candidate)?.id ?? null;
            if (matched) {
                category = matched;
                consumed.add(catIdx);
                consumed.add(catIdx + 1);
            }
        }
        if (!category) {
            const auto = autoCategorize(raw);
            if (auto && auto !== 'uncategorized') category = auto;
        }
    }

    // --- Location ("location X" preferred, else "at X") ---
    // Captures the place phrase after an anchor. Open-ended, so it runs after
    // every other field is consumed and stops at the next structural keyword or
    // sentence connector — whatever's left is handed off for geocoding.
    let location: string | null = null;
    {
        const findAnchor = (anchor: string): number => {
            for (let i = 0; i < w.length; i++) {
                if (!consumed.has(i) && w[i] === anchor) return i;
            }
            return -1;
        };
        let anchorIdx = findAnchor('location');
        if (anchorIdx < 0) anchorIdx = findAnchor('at');
        if (anchorIdx >= 0) {
            const captured: number[] = [];
            for (let j = anchorIdx + 1; j < w.length; j++) {
                if (consumed.has(j) || LOCATION_STOP.has(w[j])) break;
                captured.push(j);
            }
            if (captured.length) {
                // Build the place string from the captured span, trimming
                // connector words off both ends ("at the cafe" → "cafe").
                let lo = 0;
                let hi = captured.length - 1;
                while (lo <= hi && EDGE_STOPWORDS.has(w[captured[lo]])) lo++;
                while (hi >= lo && EDGE_STOPWORDS.has(w[captured[hi]])) hi--;
                const phrase = captured.slice(lo, hi + 1)
                    .map(idx => original[idx]).join(' ').replace(/\s+/g, ' ').trim();
                if (phrase) {
                    location = phrase;
                    // Consume the whole captured span — including the trimmed
                    // articles — plus the anchor, so no part of the location
                    // region leaks into the leftover description.
                    consumed.add(anchorIdx);
                    captured.forEach(idx => consumed.add(idx));
                }
            }
        }
    }

    // --- Description anchor: a spoken "description" / "desc" keyword. The
    // description is already whatever's left over, so the keyword itself just
    // needs stripping out rather than routing anything. ---
    for (let i = 0; i < w.length; i++) {
        if (w[i] === 'description' || w[i] === 'desc') consumed.add(i);
    }

    // --- Description: the leftover, with consumed spans removed ---
    let descParts = original.filter((_, idx) => !consumed.has(idx));
    while (descParts.length && EDGE_STOPWORDS.has(descParts[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) {
        descParts = descParts.slice(1);
    }
    while (descParts.length && EDGE_STOPWORDS.has(descParts[descParts.length - 1].toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) {
        descParts = descParts.slice(0, -1);
    }
    const description = descParts.join(' ').replace(/\s+/g, ' ').trim();

    let amount: string | null = null;
    if (amountValue !== null) {
        const rounded = Math.round(amountValue * 100) / 100;
        amount = String(rounded);
    }

    return { amount, currency, category, paymentMethod, tags, notes, location, description, raw };
}
