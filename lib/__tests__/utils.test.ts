import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

/**
 * Regression guard for the named type scale.
 *
 * tailwind-merge classifies any `text-*` it does not recognise as a font-size
 * into its catch-all colour group. Before `extendTailwindMerge` was configured,
 * `cn('text-meta', 'text-amber-50')` dropped `text-meta` entirely and the
 * element inherited 16px — invisible in a stylesheet diff, so only a test at
 * this level catches it.
 */
describe('cn — named type scale survives merging', () => {
    const scale = ['micro', 'caption', 'meta', 'body', 'lead', 'eyebrow', 'hero'] as const;

    it.each(scale)('keeps text-%s alongside a colour class', (token) => {
        expect(cn(`text-${token}`, 'text-amber-50')).toContain(`text-${token}`);
        expect(cn(`text-${token}`, 'text-amber-50')).toContain('text-amber-50');
    });

    it.each(scale)('keeps text-%s when the colour comes first', (token) => {
        expect(cn('text-amber-50', `text-${token}`)).toContain(`text-${token}`);
        expect(cn('text-amber-50', `text-${token}`)).toContain('text-amber-50');
    });

    it('still dedupes one scale step against another', () => {
        expect(cn('text-body', 'text-lead')).toBe('text-lead');
        expect(cn('text-hero', 'text-meta')).toBe('text-meta');
    });

    it('still lets an arbitrary length and a scale step conflict', () => {
        expect(cn('text-[11px]', 'text-meta')).toBe('text-meta');
        expect(cn('text-meta', 'text-[11px]')).toBe('text-[11px]');
    });

    it('leaves the stock size steps alone', () => {
        expect(cn('text-xs', 'text-sm')).toBe('text-sm');
        expect(cn('text-sm', 'text-meta')).toBe('text-meta');
    });

    it('does not swallow non-size text utilities', () => {
        expect(cn('text-center', 'text-meta')).toBe('text-center text-meta');
        expect(cn('text-nowrap', 'text-meta')).toBe('text-nowrap text-meta');
    });

    it('still merges colours against each other', () => {
        expect(cn('text-primary', 'text-amber-50')).toBe('text-amber-50');
    });

    it('dedupes per breakpoint variant', () => {
        expect(cn('sm:text-body', 'sm:text-lead')).toBe('sm:text-lead');
        expect(cn('text-body', 'sm:text-lead')).toBe('text-body sm:text-lead');
    });

    it('reproduces the Quick Pins call sites', () => {
        expect(cn('text-meta font-bold leading-tight tracking-tight truncate flex-1', 'text-amber-50'))
            .toContain('text-meta');
        expect(cn('text-micro font-bold mt-0.5 truncate max-w-[120px] uppercase tracking-tighter', 'text-amber-500/80'))
            .toContain('text-micro');
    });
});
