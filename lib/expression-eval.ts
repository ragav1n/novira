/**
 * Tiny safe arithmetic evaluator for the expense amount field.
 * Accepts +, -, *, /, parentheses, and decimal numbers. Anything else returns null.
 * Implemented with shunting-yard so we don't go anywhere near eval().
 */
export function evaluateExpression(input: string): number | null {
    if (typeof input !== 'string') return null;
    const cleaned = input.replace(/\s+/g, '').replace(/,/g, '.');
    if (!cleaned) return null;
    if (!/^[0-9+\-*/.()]+$/.test(cleaned)) return null;
    if (!/[+\-*/]/.test(cleaned)) return null; // not an expression — caller decides

    type Token = { type: 'num'; value: number } | { type: 'op'; value: '+' | '-' | '*' | '/' } | { type: 'lp' } | { type: 'rp' };
    const tokens: Token[] = [];
    let i = 0;
    while (i < cleaned.length) {
        const c = cleaned[i];
        if (c === '(') { tokens.push({ type: 'lp' }); i++; continue; }
        if (c === ')') { tokens.push({ type: 'rp' }); i++; continue; }
        if (c === '+' || c === '-' || c === '*' || c === '/') {
            // Unary minus / plus: rewrite as 0 op num
            const prev = tokens[tokens.length - 1];
            const isUnary = !prev || prev.type === 'op' || prev.type === 'lp';
            if (isUnary && (c === '-' || c === '+')) {
                tokens.push({ type: 'num', value: 0 });
            }
            tokens.push({ type: 'op', value: c });
            i++;
            continue;
        }
        // Number
        let j = i;
        let dotSeen = false;
        while (j < cleaned.length && (/[0-9]/.test(cleaned[j]) || (cleaned[j] === '.' && !dotSeen))) {
            if (cleaned[j] === '.') dotSeen = true;
            j++;
        }
        if (j === i) return null;
        const n = Number(cleaned.slice(i, j));
        if (!Number.isFinite(n)) return null;
        tokens.push({ type: 'num', value: n });
        i = j;
    }

    const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const output: Token[] = [];
    const opStack: Token[] = [];
    for (const t of tokens) {
        if (t.type === 'num') {
            output.push(t);
        } else if (t.type === 'op') {
            while (opStack.length) {
                const top = opStack[opStack.length - 1];
                if (top.type === 'op' && prec[top.value] >= prec[t.value]) {
                    output.push(opStack.pop()!);
                } else break;
            }
            opStack.push(t);
        } else if (t.type === 'lp') {
            opStack.push(t);
        } else if (t.type === 'rp') {
            let matched = false;
            while (opStack.length) {
                const top = opStack.pop()!;
                if (top.type === 'lp') { matched = true; break; }
                output.push(top);
            }
            if (!matched) return null;
        }
    }
    while (opStack.length) {
        const top = opStack.pop()!;
        if (top.type === 'lp' || top.type === 'rp') return null;
        output.push(top);
    }

    const stack: number[] = [];
    for (const t of output) {
        if (t.type === 'num') {
            stack.push(t.value);
        } else if (t.type === 'op') {
            const b = stack.pop();
            const a = stack.pop();
            if (a === undefined || b === undefined) return null;
            switch (t.value) {
                case '+': stack.push(a + b); break;
                case '-': stack.push(a - b); break;
                case '*': stack.push(a * b); break;
                case '/':
                    if (b === 0) return null;
                    stack.push(a / b); break;
            }
        }
    }
    if (stack.length !== 1) return null;
    const result = stack[0];
    if (!Number.isFinite(result) || result < 0) return null;
    return Math.round(result * 100) / 100;
}
