import { describe, it, expect } from 'vitest';
import { parseVoiceExpense } from '../voice-expense-parser';

describe('parseVoiceExpense', () => {
    it('returns an empty result for an empty transcript', () => {
        const r = parseVoiceExpense('');
        expect(r.amount).toBeNull();
        expect(r.currency).toBeNull();
        expect(r.category).toBeNull();
        expect(r.paymentMethod).toBeNull();
        expect(r.tags).toEqual([]);
        expect(r.notes).toBeNull();
        expect(r.location).toBeNull();
        expect(r.description).toBe('');
    });

    it('parses a digit amount with a currency word', () => {
        const r = parseVoiceExpense('42 dollars groceries');
        expect(r.amount).toBe('42');
        expect(r.currency).toBe('USD');
        expect(r.category).toBe('groceries');
        expect(r.description).toBe('groceries');
    });

    it('parses the full dictation example with spelled cents and a tag', () => {
        const r = parseVoiceExpense('forty two dollars fifty groceries paid with credit card tag weekly');
        expect(r.amount).toBe('42.5');
        expect(r.currency).toBe('USD');
        expect(r.category).toBe('groceries');
        expect(r.paymentMethod).toBe('Credit Card');
        expect(r.tags).toEqual(['weekly']);
        expect(r.description).toBe('groceries');
    });

    it('parses a spelled amount with a currency word', () => {
        const r = parseVoiceExpense('twelve euros uber');
        expect(r.amount).toBe('12');
        expect(r.currency).toBe('EUR');
        expect(r.category).toBe('transport');
        expect(r.description).toBe('uber');
    });

    it('parses a currency symbol glued to a digit', () => {
        const r = parseVoiceExpense('$50 coffee');
        expect(r.amount).toBe('50');
        expect(r.currency).toBe('USD');
        expect(r.description).toBe('coffee');
    });

    it('parses spelled-out hundreds', () => {
        const r = parseVoiceExpense('bank transfer rent five hundred');
        expect(r.amount).toBe('500');
        expect(r.paymentMethod).toBe('Bank Transfer');
        expect(r.category).toBe('rent');
        expect(r.description).toBe('rent');
    });

    it('detects each payment method', () => {
        expect(parseVoiceExpense('lunch cash').paymentMethod).toBe('Cash');
        expect(parseVoiceExpense('lunch debit card').paymentMethod).toBe('Debit Card');
        expect(parseVoiceExpense('lunch paid with upi').paymentMethod).toBe('UPI');
        expect(parseVoiceExpense('lunch bank transfer').paymentMethod).toBe('Bank Transfer');
    });

    it('collects multiple tags', () => {
        const r = parseVoiceExpense('tag work tag urgent');
        expect(r.tags).toEqual(['work', 'urgent']);
        expect(r.description).toBe('');
    });

    it('captures notes after a note anchor', () => {
        const r = parseVoiceExpense('lunch note client meeting downtown');
        expect(r.notes).toBe('client meeting downtown');
        expect(r.description).toBe('lunch');
    });

    it('honours an explicit category anchor', () => {
        const r = parseVoiceExpense('category beauty thirty dollars');
        expect(r.category).toBe('beauty');
        expect(r.amount).toBe('30');
        expect(r.currency).toBe('USD');
    });

    it('strips a spoken "description" / "desc" keyword', () => {
        expect(parseVoiceExpense('description eggs and bread').description).toBe('eggs and bread');
        const r = parseVoiceExpense('forty dollars desc grocery run');
        expect(r.amount).toBe('40');
        expect(r.description).toBe('grocery run');
    });

    it('leaves everything in description when nothing is recognised', () => {
        const r = parseVoiceExpense('lunch with friends');
        expect(r.amount).toBeNull();
        expect(r.currency).toBeNull();
        expect(r.category).toBeNull();
        expect(r.paymentMethod).toBeNull();
        expect(r.location).toBeNull();
        expect(r.description).toBe('lunch with friends');
    });

    it('captures a location after an "at" anchor', () => {
        const r = parseVoiceExpense('coffee at starbucks');
        expect(r.location).toBe('starbucks');
        expect(r.description).toBe('coffee');
    });

    it('captures a multi-word location and trims a leading article', () => {
        const r = parseVoiceExpense('forty dollars at the cafe paid with credit card');
        expect(r.location).toBe('cafe');
        expect(r.amount).toBe('40');
        expect(r.paymentMethod).toBe('Credit Card');
    });

    it('does not leak trimmed location connector words into the description', () => {
        const r = parseVoiceExpense('lunch at the cafe with john');
        expect(r.location).toBe('cafe');
        expect(r.description).toBe('lunch with john');
    });

    it('honours an explicit "location" anchor', () => {
        const r = parseVoiceExpense('lunch location trader joes');
        expect(r.location).toBe('trader joes');
        expect(r.description).toBe('lunch');
    });

    it('stops the location capture at the next field keyword', () => {
        const r = parseVoiceExpense('groceries at whole foods tag weekly');
        expect(r.location).toBe('whole foods');
        expect(r.tags).toEqual(['weekly']);
        expect(r.description).toBe('groceries');
    });

    it('keeps the raw transcript', () => {
        expect(parseVoiceExpense('  hello world  ').raw).toBe('hello world');
    });
});
