import React from 'react';
import { Users, CheckCircle2, User, Home, Plane, Heart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Group, Friend } from '@/components/providers/groups-provider';

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
    return (
        <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border border-white/5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-sm font-medium">Split this expense</p>
                        <p className="text-[11px] text-muted-foreground">Divide cost with others</p>
                    </div>
                </div>
                <Switch
                    checked={isSplitEnabled}
                    onCheckedChange={setIsSplitEnabled}
                />
            </div>

            {isSplitEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Split Mode Toggle */}
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
                            className={cn(
                                "py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all",
                                splitMode === 'custom'
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                    : "bg-background/20 border-white/5 text-muted-foreground hover:border-white/10"
                            )}
                        >
                            Custom Amounts
                        </button>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Split with Group</p>
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
                                    <span className="text-[11px] font-medium truncate w-16 text-center">{group.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Or Split with Friends</p>
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
                                            <img src={friend.avatar_url} alt={friend.full_name} className="w-full h-full object-cover" />
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
                                    <span className="text-[11px] font-medium truncate w-16 text-center">{friend.full_name.split(' ')[0]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Amount Inputs */}
                    {splitMode === 'custom' && (selectedFriendIds.length > 0 || selectedGroupId) && (
                        <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Enter amounts each person owes you</p>
                            {selectedGroupId ? (
                                // For groups, we show group members (fetched dynamically)
                                <p className="text-[11px] text-muted-foreground italic">Custom amounts for group members will be applied after saving</p>
                            ) : (
                                selectedFriendIds.map((friendId) => {
                                    const friend = friends.find(f => f.id === friendId);
                                    if (!friend) return null;
                                    return (
                                        <div key={friendId} className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 min-w-[100px]">
                                                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/5 shrink-0">
                                                    {friend.avatar_url ? (
                                                        <img src={friend.avatar_url} alt={friend.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                                            <User className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-xs font-medium truncate">{friend.full_name.split(' ')[0]}</span>
                                            </div>
                                            <div className="relative flex-1">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={customAmounts[friendId] || ''}
                                                    onChange={(e) => setCustomAmounts(prev => ({ ...prev, [friendId]: e.target.value }))}
                                                    className="h-9 text-sm pl-8 bg-secondary/10 border-white/10 rounded-lg"
                                                />
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                    {CURRENCY_SYMBOLS[currency] || '$'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Running total */}
                            {selectedFriendIds.length > 0 && !selectedGroupId && (() => {
                                const totalAllocated = selectedFriendIds.reduce((sum, id) => sum + (parseFloat(customAmounts[id] || '0') || 0), 0);
                                const expenseAmount = parseFloat(amount) || 0;
                                const yourShare = expenseAmount - totalAllocated;
                                return (
                                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-muted-foreground">Others owe:</span>
                                            <span className="font-medium text-emerald-500">
                                                {CURRENCY_SYMBOLS[currency] || '$'}{totalAllocated.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-muted-foreground">Your share:</span>
                                            <span className={cn("font-medium", yourShare < 0 ? "text-red-400" : "text-white")}>
                                                {CURRENCY_SYMBOLS[currency] || '$'}{yourShare.toFixed(2)}
                                            </span>
                                        </div>
                                        {yourShare < 0 && (
                                            <p className="text-[11px] text-red-400">⚠ Split amounts exceed the total expense</p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Even split preview */}
                    {splitMode === 'even' && (selectedFriendIds.length > 0 || selectedGroupId) && amount && (
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[11px] text-muted-foreground text-center">
                                {selectedGroupId ? (
                                    <>Split <span className="font-medium text-primary">equally</span> among all group members</>
                                ) : (
                                    <>Each person pays <span className="font-medium text-primary">
                                        {CURRENCY_SYMBOLS[currency] || '$'}
                                        {(parseFloat(amount) / (selectedFriendIds.length + 1)).toFixed(2)}
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
