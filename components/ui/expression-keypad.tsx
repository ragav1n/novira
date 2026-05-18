'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { evaluateExpression } from '@/lib/expression-eval';

interface ExpressionKeypadProps {
    inputRef: React.RefObject<HTMLInputElement | null>;
    value: string;
    onChange: (next: string) => void;
    className?: string;
    size?: 'sm' | 'md';
}

const KEYS: Array<{ label: string; insert: string; aria: string }> = [
    { label: '+', insert: '+', aria: 'plus' },
    { label: '−', insert: '-', aria: 'minus' },
    { label: '×', insert: '*', aria: 'times' },
    { label: '÷', insert: '/', aria: 'divide' },
    { label: '(', insert: '(', aria: 'open parenthesis' },
    { label: ')', insert: ')', aria: 'close parenthesis' },
];

export function ExpressionKeypad({ inputRef, value, onChange, className, size = 'sm' }: ExpressionKeypadProps) {
    const insertAtCursor = (ch: string) => {
        const input = inputRef.current;
        if (!input) {
            onChange(value + ch);
            return;
        }
        const start = input.selectionStart ?? value.length;
        const end = input.selectionEnd ?? value.length;
        const next = value.slice(0, start) + ch + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
            input.focus();
            const pos = start + ch.length;
            input.setSelectionRange(pos, pos);
        });
    };

    const evaluate = () => {
        const result = evaluateExpression(value);
        if (result !== null) {
            onChange(String(result));
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    };

    const cellBase = size === 'sm'
        ? 'h-8 min-w-8 px-2 text-sm'
        : 'h-10 min-w-10 px-3 text-base';

    const btn = cn(
        cellBase,
        'inline-flex items-center justify-center rounded-md bg-secondary/30 hover:bg-secondary/50 active:bg-secondary/70',
        'font-semibold text-foreground/85 border border-white/10 transition-colors cursor-pointer',
        'select-none touch-manipulation',
    );

    const equalsBtn = cn(
        cellBase,
        'inline-flex items-center justify-center rounded-md bg-primary/20 hover:bg-primary/30 active:bg-primary/40',
        'font-semibold text-primary border border-primary/30 transition-colors cursor-pointer',
        'select-none touch-manipulation',
    );

    return (
        <div className={cn('flex items-center gap-1.5 flex-wrap', className)} role="group" aria-label="Arithmetic operators">
            {KEYS.map(k => (
                <div
                    key={k.label}
                    role="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertAtCursor(k.insert)}
                    className={btn}
                    aria-label={`Insert ${k.aria}`}
                >
                    {k.label}
                </div>
            ))}
            <div
                role="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={evaluate}
                className={equalsBtn}
                aria-label="Evaluate expression"
            >
                =
            </div>
        </div>
    );
}
