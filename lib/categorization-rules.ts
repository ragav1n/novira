export type RuleMatchField = 'description' | 'place_name';
export type RuleMatchType = 'contains' | 'equals' | 'regex';

export type CategorizationRule = {
    id: string;
    user_id: string;
    match_field: RuleMatchField;
    match_type: RuleMatchType;
    pattern: string;
    category: string | null;
    bucket_id: string | null;
    exclude_from_allowance: boolean | null;
    priority: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type RuleApplyInput = {
    description?: string | null;
    place_name?: string | null;
};

export type RuleApplyOutput = {
    category?: string;
    bucket_id?: string;
    exclude_from_allowance?: boolean;
};

const MAX_PATTERN_LENGTH = 200;

function matchOne(rule: CategorizationRule, input: string): boolean {
    if (!rule.is_active) return false;
    if (!input) return false;
    if (!rule.pattern || rule.pattern.length > MAX_PATTERN_LENGTH) return false;

    const haystackLower = input.toLowerCase();
    const needleLower = rule.pattern.toLowerCase();

    switch (rule.match_type) {
        case 'equals':
            return haystackLower === needleLower;
        case 'contains':
            return haystackLower.includes(needleLower);
        case 'regex':
            try {
                const re = new RegExp(rule.pattern, 'i');
                return re.test(input);
            } catch {
                // Bad regex — treat as no match. The settings UI validates on save
                // but a stale or hand-edited row shouldn't break the form.
                return false;
            }
        default:
            return false;
    }
}

/**
 * Pure rule evaluator. Returns the fields that rules want to set; the caller
 * decides whether to apply them (typically: only when the field is still at
 * its initial default so a user's manual choice isn't stomped).
 *
 * Sort is by `priority desc`; first match per output field wins.
 */
export function applyRules(input: RuleApplyInput, rules: CategorizationRule[]): RuleApplyOutput {
    if (!rules.length) return {};
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    const out: RuleApplyOutput = {};
    for (const rule of sorted) {
        const haystack = rule.match_field === 'description'
            ? (input.description || '')
            : (input.place_name || '');
        if (!matchOne(rule, haystack)) continue;
        if (rule.category && out.category === undefined) out.category = rule.category;
        if (rule.bucket_id && out.bucket_id === undefined) out.bucket_id = rule.bucket_id;
        if (rule.exclude_from_allowance !== null && rule.exclude_from_allowance !== undefined && out.exclude_from_allowance === undefined) {
            out.exclude_from_allowance = rule.exclude_from_allowance;
        }
        if (out.category !== undefined && out.bucket_id !== undefined && out.exclude_from_allowance !== undefined) break;
    }
    return out;
}

/**
 * Validate a regex pattern at the boundary (rule create/edit). Returns the
 * error message if invalid, or null if it compiles. Doesn't catch every ReDoS
 * — pattern length cap is the primary mitigation — but rejects obvious typos.
 */
export function validateRulePattern(matchType: RuleMatchType, pattern: string): string | null {
    if (!pattern.trim()) return 'Pattern is required';
    if (pattern.length > MAX_PATTERN_LENGTH) return `Pattern must be ${MAX_PATTERN_LENGTH} characters or fewer`;
    if (matchType === 'regex') {
        try {
            new RegExp(pattern, 'i');
        } catch (e) {
            return `Invalid regex: ${(e as Error).message}`;
        }
    }
    return null;
}
