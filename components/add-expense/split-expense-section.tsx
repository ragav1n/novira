import React, { useEffect, useRef, useState } from 'react';
import { Users, CheckCircle2, User, Home, Plane, Heart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Group, Friend } from '@/components/providers/groups-provider';
import { evaluateExpression } from '@/lib/expression-eval';
import { parseAmountStrict, toCents } from '@/lib/expense-validation';
import { ExpressionKeypad } from '@/components/ui/expression-keypad';

interface SplitFriendRowProps {
    friend: Friend;
    value: string;
    onChange: (next: string) => void;
    currency: string;
    CURRENCY_SYMBOLS: Record<string, string>;
}

function SplitFriendRow({ friend, value, onChange, currency, CURRENCY_SYMBOLS }: SplitFriendRowProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    const preview = evaluateExpression(value);

    const commit = () => {
        const r = evaluateExpression(value);
        if (r !== null) onChange(String(r));
    };

    return (
        <div className="space-y-1">
            <div className="flex items-end gap-3">
                <div className="flex items-center gap-2 min-w-[100px] h-9">
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-white/5 shrink-0">
                        {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.full_name} width={28} height={28} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                <User className="w-3.5 h-3.5" />
                            </div>
                        )}
                    </div>
                    <span className="text-xs font-medium truncate">{friend.full_name.split(' ')[0]}</span>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                    {focused && (
                        <ExpressionKeypad
                            inputRef={inputRef}
                            value={value}
                            onChange={onChange}
                            size="sm"
                        />
                    )}
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => { setFocused(false); commit(); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const r = evaluateExpression(value);
                                    if (r !== null) {
                                        e.preventDefault();
                                        onChange(String(r));
                                    }
                                }
                            }}
                            className="h-9 text-sm pl-8 bg-secondary/10 border-white/10 rounded-lg"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {CURRENCY_SYMBOLS[currency] || '$'}
                        </span>
                    </div>
                </div>
            </div>
            {preview !== null && (
                <p className="text-caption text-muted-foreground font-medium pl-[112px]">
                    = <span className="font-bold text-primary">{CURRENCY_SYMBOLS[currency] || '$'}{preview.toFixed(2)}</span>
                    <span className="text-muted-foreground/60"> · tap away or press Enter to apply</span>
                </p>
            )}
        </div>
    );
}

interface SplitExpenseSectionProps {
    isSplitEnabled: boolean;
    setIsSplitEnabled: (val: boolean) => void;
    splitMode: 'even' | 'custom';
    setSplitMode: (val: 'even' | 'custom') => void;
    groups: Group[];
    friends: Friend[];
    selectedGroupId: string | null;
    setSelectedGroupId: (id: string | null) => void;
    selectedFriendIds: string[];
    setSelectedFriendIds: React.Dispatch<React.SetStateAction<string[]>>;
    customAmounts: Record<string, string>;
    setCustomAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    amount: string;
    currency: string;
    CURRENCY_SYMBOLS: Record<string, string>;
}

export function SplitExpenseSection({
    isSplitEnabled,
    setIsSplitEnabled,
    splitMode,
    setSplitMode,
    groups,
    friends,
    selectedGroupId,
    setSelectedGroupId,
    selectedFriendIds,
    setSelectedFriendIds,
    customAmounts,
    setCustomAmounts,
    amount,
    currency,
    CURRENCY_SYMBOLS
}: SplitExpenseSectionProps) {
    // A group has no per-member amount inputs, so group + custom is a state the
    // user cannot fill in and cannot save. The Custom button is disabled while a
    // group is selected; this catches the orders that button can't — picking a
    // group after choosing Custom, or a restored draft carrying the combination.
    useEffect(() => {
        if (selectedGroupId && splitMode === 'custom') setSplitMode('even');
    }, [selectedGroupId, splitMode, setSplitMode]);

    return (
        <div className="space-y-4 p-4 rounded-xl bg-secondary/10 border border-white/5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-sm font-medium">Split this expense</p>
                        <p className="text-meta text-muted-foreground">Divide cost with others</p>
                    </div>
                </div>
                <Switch
                    checked={isSplitEnabled}
                    onCheckedChange={setIsSplitEnabled}
                />
            </div>

            {isSplitEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Split Mode Toggle. Custom is friends-only: there are no
                        per-member inputs for a group, so leaving it selected made
                        the expense unsavable ("Please enter split amounts" with no
                        field to fill). */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setSplitMode('even')}
                            className={cn(
                                "py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all",
                                splitMode === 'even'
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                    : "bg-background/20 border-white/5 text-muted-foreground hover:border-white/10"
                            )}
                        >
                            Even Split
                        </button>
                        <button
                            onClick={() => setSplitMode('custom')}
                            disabled={!!selectedGroupId}
                            title={selectedGroupId ? 'Custom amounts are only available when splitting with friends' : undefined}
                            className={cn(
                                "py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all",
                                selectedGroupId
                                    ? "bg-background/10 border-white/5 text-muted-foreground/40 cursor-not-allowed"
                                    : splitMode === 'custom'
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                        : "bg-background/20 border-white/5 text-muted-foreground hover:border-white/10"
                            )}
                        >
                            Custom Amounts
                        </button>
                    </div>

                    <div className="space-y-2">
                        <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wider">Split with Group</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                            {groups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => {
                                        setSelectedGroupId(selectedGroupId === group.id ? null : group.id);
                                        setSelectedFriendIds([]);
                                        setCustomAmounts({});
                                    }}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                                        selectedGroupId === group.id
                                            ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                            : "bg-background/20 border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center relative">
                                        {group.type === 'home' && <Home className="w-5 h-5 text-blue-400" />}
                                        {group.type === 'couple' && <Heart className="w-5 h-5 text-rose-400" />}
                                        {group.type === 'trip' && <Plane className="w-5 h-5 text-emerald-400" />}
                                        {(!group.type || (group.type !== 'home' && group.type !== 'couple' && group.type !== 'trip')) && <Users className="w-5 h-5 text-primary" />}
                                        {selectedGroupId === group.id && (
                                            <div className="absolute -top-1 -right-1">
                                                <CheckCircle2 className="w-4 h-4 text-primary fill-background" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-meta font-medium truncate w-16 text-center">{group.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wider">Or Split with Friends</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                            {friends.map((friend) => (
                                <div
                                    key={friend.id}
                                    onClick={() => {
                                        if (selectedGroupId) setSelectedGroupId(null);
                                        setSelectedFriendIds(prev => {
                                            const next = prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id];
                                            // Clean up custom amounts for deselected friends
                                            if (!next.includes(friend.id)) {
                                                setCustomAmounts(prevAmounts => {
                                                    const copy = { ...prevAmounts };
                                                    delete copy[friend.id];
                                                    return copy;
                                                });
                                            }
                                            return next;
                                        });
                                    }}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                                        selectedFriendIds.includes(friend.id)
                                            ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                            : "bg-background/20 border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/5 relative">
                                        {friend.avatar_url ? (
                                            <img src={friend.avatar_url} alt={friend.full_name} width={40} height={40} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                                <User className="w-5 h-5" />
                                            </div>
                                        )}
                                        {selectedFriendIds.includes(friend.id) && (
                                            <div className="absolute -top-1 -right-1">
                                                <CheckCircle2 className="w-4 h-4 text-primary fill-background" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-meta font-medium truncate w-16 text-center">{friend.full_name.split(' ')[0]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Amount Inputs */}
                    {splitMode === 'custom' && (selectedFriendIds.length > 0 || selectedGroupId) && (
                        <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wider">Enter amounts each person owes you</p>
                            {selectedGroupId ? (
                                // Unreachable now that Custom is disabled for groups, but kept
                                // as a truthful fallback rather than the old claim that custom
                                // amounts "will be applied after saving" — they never were.
                                <p className="text-meta text-muted-foreground italic">Custom amounts aren&apos;t available for groups — use Even Split.</p>
                            ) : (
                                selectedFriendIds.map((friendId) => {
                                    const friend = friends.find(f => f.id === friendId);
                                    if (!friend) return null;
                                    return (
                                        <SplitFriendRow
                                            key={friendId}
                                            friend={friend}
                                            value={customAmounts[friendId] || ''}
                                            onChange={(next) => setCustomAmounts(prev => ({ ...prev, [friendId]: next }))}
                                            currency={currency}
                                            CURRENCY_SYMBOLS={CURRENCY_SYMBOLS}
                                        />
                                    );
                                })
                            )}

                            {/* Running total */}
                            {selectedFriendIds.length > 0 && !selectedGroupId && (() => {
                                const resolveAmount = (raw: string): number => {
                                    const evaluated = evaluateExpression(raw);
                                    if (evaluated !== null) return evaluated;
                                    const n = parseFloat(raw);
                                    return Number.isFinite(n) ? n : 0;
                                };
                                // Cents, not floats: 1.1 + 2.2 is 3.3000000000000003, which
                                // rendered a balanced split as "Your share: $-0.00" in red
                                // with an "exceeds the total" warning.
                                const allocatedCents = selectedFriendIds.reduce((sum, id) => sum + toCents(resolveAmount(customAmounts[id] || '')), 0);
                                const expenseCents = toCents(resolveAmount(amount));
                                const shareCents = expenseCents - allocatedCents;
                                const totalAllocated = allocatedCents / 100;
                                const yourShare = shareCents / 100;
                                return (
                                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                                        <div className="flex justify-between text-meta">
                                            <span className="text-muted-foreground">Others owe:</span>
                                            <span className="font-medium text-emerald-500">
                                                {CURRENCY_SYMBOLS[currency] || '$'}{totalAllocated.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-meta">
                                            <span className="text-muted-foreground">Your share:</span>
                                            <span className={cn("font-medium", shareCents < 0 ? "text-red-400" : "text-white")}>
                                                {CURRENCY_SYMBOLS[currency] || '$'}{yourShare.toFixed(2)}
                                            </span>
                                        </div>
                                        {shareCents < 0 && (
                                            <p className="text-meta text-red-400">⚠ Split amounts exceed the total expense</p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Even split preview */}
                    {splitMode === 'even' && (selectedFriendIds.length > 0 || selectedGroupId) && amount && (
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-meta text-muted-foreground text-center">
                                {selectedGroupId ? (
                                    <>Split <span className="font-medium text-primary">equally</span> among all group members</>
                                ) : (
                                    <>Each person pays <span className="font-medium text-primary">
                                        {CURRENCY_SYMBOLS[currency] || '$'}
                                        {((evaluateExpression(amount) ?? parseAmountStrict(amount) ?? 0) / (selectedFriendIds.length + 1)).toFixed(2)}
                                    </span></>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
