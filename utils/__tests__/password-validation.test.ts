import { describe, it, expect } from 'vitest';
import { validatePassword } from '../password-validation';

describe('validatePassword', () => {
    describe('valid passwords', () => {
        it('accepts a strong password with all requirements', () => {
            const result = validatePassword('Secure#123');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.length).toBe(true);
            expect(result.uppercase).toBe(true);
            expect(result.lowercase).toBe(true);
            expect(result.number).toBe(true);
            expect(result.symbol).toBe(true);
        });

        it('accepts a password with exactly 8 characters', () => {
            const result = validatePassword('Ab1!wxyz');
            expect(result.isValid).toBe(true);
        });

        it('accepts various symbol types', () => {
            expect(validatePassword('Pass1@word').isValid).toBe(true);
            expect(validatePassword('Pass1!word').isValid).toBe(true);
            expect(validatePassword('Pass1#word').isValid).toBe(true);
            expect(validatePassword('Pass1$word').isValid).toBe(true);
            expect(validatePassword('Pass1%word').isValid).toBe(true);
        });
    });

    describe('length check', () => {
        it('fails when password is too short', () => {
            const result = validatePassword('Ab1!xyz');
            expect(result.isValid).toBe(false);
            expect(result.length).toBe(false);
            expect(result.error).toBe('Password must be at least 8 characters');
        });

        it('fails for empty string', () => {
            const result = validatePassword('');
            expect(result.isValid).toBe(false);
            expect(result.length).toBe(false);
        });
    });

    describe('uppercase check', () => {
        it('fails when no uppercase letter', () => {
            const result = validatePassword('secure#123');
            expect(result.isValid).toBe(false);
            expect(result.uppercase).toBe(false);
            expect(result.error).toBe('Password must contain at least one uppercase letter');
        });
    });

    describe('lowercase check', () => {
        it('fails when no lowercase letter', () => {
            const result = validatePassword('SECURE#123');
            expect(result.isValid).toBe(false);
            expect(result.lowercase).toBe(false);
            expect(result.error).toBe('Password must contain at least one lowercase letter');
        });
    });

    describe('number check', () => {
        it('fails when no number', () => {
            const result = validatePassword('Secure#abc');
            expect(result.isValid).toBe(false);
            expect(result.number).toBe(false);
            expect(result.error).toBe('Password must contain at least one number');
        });
    });

    describe('symbol check', () => {
        it('fails when no symbol', () => {
            const result = validatePassword('Secure1234');
            expect(result.isValid).toBe(false);
            expect(result.symbol).toBe(false);
            expect(result.error).toBe('Password must contain at least one symbol');
        });
    });

    describe('error priority', () => {
        it('reports length error first even when other checks fail', () => {
            const result = validatePassword('ab1'); // short, no upper, no symbol
            expect(result.error).toBe('Password must be at least 8 characters');
        });

        it('reports uppercase error before lowercase when length passes', () => {
            const result = validatePassword('secure#123'); // no upper, no symbol... wait has symbol
            expect(result.error).toBe('Password must contain at least one uppercase letter');
        });
    });

    describe('individual check flags', () => {
        it('correctly reports all false checks for a weak password', () => {
            const result = validatePassword('ab');
            expect(result.length).toBe(false);
            expect(result.uppercase).toBe(false);
            expect(result.number).toBe(false);
            expect(result.symbol).toBe(false);
            expect(result.lowercase).toBe(true); // has lowercase
        });
    });
});
