import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_COLORS, getCategoryLabel, autoCategorize, CHART_CONFIG } from '../categories';

describe('CATEGORIES constant', () => {
    it('contains all expected category ids', () => {
        const ids = CATEGORIES.map(c => c.id);
        expect(ids).toContain('food');
        expect(ids).toContain('groceries');
        expect(ids).toContain('transport');
        expect(ids).toContain('fashion');
        expect(ids).toContain('beauty');
        expect(ids).toContain('healthcare');
        expect(ids).toContain('rent');
        expect(ids).toContain('bills');
        expect(ids).toContain('shopping');
        expect(ids).toContain('entertainment');
        expect(ids).toContain('education');
        expect(ids).toContain('others');
        expect(ids).toContain('uncategorized');
    });

    it('has matching labels', () => {
        const food = CATEGORIES.find(c => c.id === 'food');
        expect(food?.label).toBe('Food');
        const uncategorized = CATEGORIES.find(c => c.id === 'uncategorized');
        expect(uncategorized?.label).toBe('Uncategorized');
    });
});

describe('CATEGORY_COLORS', () => {
    it('has a color for every category in CATEGORIES', () => {
        for (const category of CATEGORIES) {
            expect(CATEGORY_COLORS).toHaveProperty(category.id);
        }
    });

    it('colors are valid hex strings', () => {
        for (const color of Object.values(CATEGORY_COLORS)) {
            expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });
});

describe('CHART_CONFIG', () => {
    it('has entries for every category', () => {
        for (const category of CATEGORIES) {
            expect(CHART_CONFIG).toHaveProperty(category.id);
        }
    });

    it('chart config colors match CATEGORY_COLORS', () => {
        for (const [id, config] of Object.entries(CHART_CONFIG)) {
            expect(config.color).toBe(CATEGORY_COLORS[id]);
        }
    });
});

describe('getCategoryLabel', () => {
    it('returns the correct label for known categories', () => {
        expect(getCategoryLabel('food')).toBe('Food');
        expect(getCategoryLabel('groceries')).toBe('Groceries');
        expect(getCategoryLabel('transport')).toBe('Transport');
        expect(getCategoryLabel('fashion')).toBe('Fashion');
        expect(getCategoryLabel('beauty')).toBe('Beauty');
        expect(getCategoryLabel('healthcare')).toBe('Healthcare');
        expect(getCategoryLabel('rent')).toBe('Rent');
        expect(getCategoryLabel('bills')).toBe('Bills');
        expect(getCategoryLabel('shopping')).toBe('Shopping');
        expect(getCategoryLabel('entertainment')).toBe('Entertainment');
        expect(getCategoryLabel('education')).toBe('Education');
        expect(getCategoryLabel('others')).toBe('Others');
        expect(getCategoryLabel('uncategorized')).toBe('Uncategorized');
    });

    it('is case-insensitive', () => {
        expect(getCategoryLabel('FOOD')).toBe('Food');
        expect(getCategoryLabel('Food')).toBe('Food');
        expect(getCategoryLabel('GROCERIES')).toBe('Groceries');
    });

    it('capitalizes unknown category ids', () => {
        expect(getCategoryLabel('custom')).toBe('Custom');
        expect(getCategoryLabel('myCategory')).toBe('MyCategory');
    });
});

describe('autoCategorize', () => {
    describe('transport', () => {
        it.each(['uber trip', 'took a taxi', 'petrol fill', 'ola cab', 'fuel refill'])(
            'categorizes "%s" as transport', (desc) => {
                expect(autoCategorize(desc)).toBe('transport');
            }
        );
    });

    describe('food', () => {
        it.each(['zomato order', 'swiggy delivery', 'restaurant dinner', 'cafe lunch', 'dining out'])(
            'categorizes "%s" as food', (desc) => {
                expect(autoCategorize(desc)).toBe('food');
            }
        );
    });

    describe('groceries', () => {
        it.each(['bought milk', 'curd packet', 'tofu block', 'supermarket run', 'bigbasket order', 'blinkit delivery', 'grocer visit'])(
            'categorizes "%s" as groceries', (desc) => {
                expect(autoCategorize(desc)).toBe('groceries');
            }
        );
    });

    describe('fashion', () => {
        it.each(['new shirt', 'clothes shopping', 'zara visit', 'h&m haul', 'myntra order', 'ajio purchase', 'apparel store'])(
            'categorizes "%s" as fashion', (desc) => {
                expect(autoCategorize(desc)).toBe('fashion');
            }
        );
    });

    describe('entertainment', () => {
        it.each(['netflix subscription', 'spotify premium', 'movie ticket', 'cinema show', 'hotstar plan', 'prime video'])(
            'categorizes "%s" as entertainment', (desc) => {
                expect(autoCategorize(desc)).toBe('entertainment');
            }
        );
    });

    describe('healthcare', () => {
        it.each(['pharmacy visit', 'doctor consultation', 'hospital bill', 'medicine purchase', 'medical test'])(
            'categorizes "%s" as healthcare', (desc) => {
                expect(autoCategorize(desc)).toBe('healthcare');
            }
        );
    });

    describe('bills', () => {
        it.each(['electricity bill', 'phone recharge', 'utility payment', 'gas bill'])(
            'categorizes "%s" as bills', (desc) => {
                expect(autoCategorize(desc)).toBe('bills');
            }
        );
    });

    describe('rent', () => {
        it.each(['monthly rent', 'lease payment', 'landlord transfer', 'maintenance fee'])(
            'categorizes "%s" as rent', (desc) => {
                expect(autoCategorize(desc)).toBe('rent');
            }
        );
    });

    describe('education', () => {
        it.each(['school fees', 'tuition class', 'online course', 'college fees', 'udemy subscription', 'coursera plan'])(
            'categorizes "%s" as education', (desc) => {
                expect(autoCategorize(desc)).toBe('education');
            }
        );
    });

    describe('beauty', () => {
        it.each(['skincare routine', 'shampoo bottle', 'nykaa order', 'sephora purchase', 'face wash', 'makeup kit', 'sunscreen spf50', 'perfume'])(
            'categorizes "%s" as beauty', (desc) => {
                expect(autoCategorize(desc)).toBe('beauty');
            }
        );
    });

    describe('shopping', () => {
        it.each(['amazon order', 'flipkart delivery', 'shop purchase'])(
            'categorizes "%s" as shopping', (desc) => {
                expect(autoCategorize(desc)).toBe('shopping');
            }
        );
    });

    describe('uncategorized fallback', () => {
        it('returns uncategorized for unknown descriptions', () => {
            expect(autoCategorize('random purchase')).toBe('uncategorized');
            expect(autoCategorize('birthday gift')).toBe('uncategorized');
            expect(autoCategorize('')).toBe('uncategorized');
        });

        it('is case-insensitive', () => {
            expect(autoCategorize('UBER TRIP')).toBe('transport');
            expect(autoCategorize('Zomato Order')).toBe('food');
        });
    });
});
