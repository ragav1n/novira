import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Plus, Users, Settings2, LogOut, FileText, Home, Plane, Heart, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import type { Group, Friend, Split } from '@/components/providers/groups-provider';
import { simplifyDebtsForGroup } from '@/utils/simplify-debts';
import { GroupSettingsDialog } from './group-settings-dialog';
import { GroupDetailSheet } from './group-detail-sheet';

interface GroupsTabContentProps {
    groups: Group[];
    friends: Friend[];
    currentUserId: string | null;
    pendingSplits: Split[];
    currency: string;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    addMemberToGroup: (groupId: string, friendId: string) => Promise<boolean | void>;
    leaveGroup: (groupId: string) => Promise<boolean | void>;
    onStartGroup: () => void;
}

const getTypeIcon = (type?: string) => {
    switch (type) {
        case 'home': return Home;
        case 'trip': return Plane;
        case 'couple': return Heart;
        default: return FileText;
    }
};

export function GroupsTabContent({
    groups, friends, currentUserId, pendingSplits, currency, formatCurrency, convertAmount,
    leaveGroup, onStartGroup
}: GroupsTabContentProps) {
    const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);
    const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
    const settingsGroup = settingsGroupId ? groups.find(g => g.id === settingsGroupId) ?? null : null;
    const detailGroup = detailGroupId ? groups.find(g => g.id === detailGroupId) ?? null : null;

    const groupBalances = useMemo(() => {
        if (!currentUserId) return new Map<string, { owe: number; owed: number }>();
        const out = new Map<string, { owe: number; owed: number }>();
        for (const group of groups) {
            const debts = simplifyDebtsForGroup(pendingSplits, currentUserId, convertAmount, currency, group.id);
            const owe = debts.filter(p => p.from === currentUserId).reduce((a, p) => a + p.amount, 0);
            const owed = debts.filter(p => p.to === currentUserId).reduce((a, p) => a + p.amount, 0);
            out.set(group.id, { owe, owed });
        }
        return out;
    }, [groups, pendingSplits, currentUserId, convertAmount, currency]);

    const parseDateOnly = (iso: string) => parseISO(iso.slice(0, 10));

    const sortedGroups = [...groups].sort((a, b) => {
        if (a.type === 'home' && b.type !== 'home') return -1;
        if (a.type !== 'home' && b.type === 'home') return 1;
        const aIsTrip = a.type === 'trip';
        const bIsTrip = b.type === 'trip';
        const now = new Date();
        const aIsPastTrip = aIsTrip && a.end_date && parseDateOnly(a.end_date) < now;
        const bIsPastTrip = bIsTrip && b.end_date && parseDateOnly(b.end_date) < now;

        if (aIsPastTrip && !bIsPastTrip) return 1;
        if (!aIsPastTrip && bIsPastTrip) return -1;

        if (aIsTrip && bIsTrip && !aIsPastTrip && !bIsPastTrip) {
            if (a.start_date && b.start_date) {
                return parseDateOnly(a.start_date).getTime() - parseDateOnly(b.start_date).getTime();
            }
        }
        return 0;
    });

    const activeGroups = sortedGroups.filter(g => {
        if (g.type !== 'trip') return true;
        if (!g.end_date) return true;
        return parseDateOnly(g.end_date) >= new Date();
    });

    const pastTrips = sortedGroups.filter(g => {
        if (g.type !== 'trip') return false;
        return g.end_date && parseDateOnly(g.end_date) < new Date();
    });

    return (
        <div className="mt-6 space-y-4">
            {settingsGroup && (
                <GroupSettingsDialog
                    group={settingsGroup}
                    friends={friends}
                    currentUserId={currentUserId}
                    pendingSplits={pendingSplits}
                    open={!!settingsGroupId}
                    onOpenChange={(open) => { if (!open) setSettingsGroupId(null); }}
                />
            )}
            {detailGroup && (
                <GroupDetailSheet
                    group={detailGroup}
                    currentUserId={currentUserId}
                    pendingSplits={pendingSplits}
                    currency={currency}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                    open={!!detailGroupId}
                    onOpenChange={(open) => { if (!open) setDetailGroupId(null); }}
                />
            )}

            {activeGroups.length > 0 ? (
                activeGroups.map((group) => {
                    const Icon = getTypeIcon(group.type);
                    const isHome = group.type === 'home';
                    const isTrip = group.type === 'trip';
                    const isCouple = group.type === 'couple';

                    const balance = groupBalances.get(group.id);

                    return (
                        <Card
                            key={group.id}
                            onClick={() => setDetailGroupId(group.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setDetailGroupId(group.id);
                                }
                            }}
                            className={cn(
                                "rounded-3xl overflow-hidden hover:bg-card/60 transition-colors border-white/5 cursor-pointer",
                                isHome ? "bg-emerald-500/5 border-emerald-500/10" : "bg-card/40"
                            )}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0",
                                            isHome ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                isTrip ? "bg-sky-500/10 border-sky-500/20 text-sky-500" :
                                                    isCouple ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                                                        "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/20 text-primary"
                                        )}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-base truncate">{group.name}</h4>
                                                {isHome && <Badge variant="secondary" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1.5">HOME</Badge>}
                                            </div>

                                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                                                {isTrip && group.start_date && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                                        <span className="text-sky-500/80 font-medium">
                                                            {format(parseDateOnly(group.start_date), 'MMM d')}
                                                            {group.end_date && ` - ${format(parseDateOnly(group.end_date), 'MMM d')}`}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="p-2 rounded-full hover:bg-secondary/30 transition-colors"
                                            title="Group settings"
                                            aria-label={`Settings for ${group.name}`}
                                            onClick={(e) => { e.stopPropagation(); setSettingsGroupId(group.id); }}
                                        >
                                            <Settings2 className="w-4 h-4 text-primary" />
                                        </button>
                                        <button
                                            className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                            title="Leave Group"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toast(`Leave ${group.name}?`, {
                                                    action: {
                                                        label: 'Leave',
                                                        onClick: async () => {
                                                            try {
                                                                await leaveGroup(group.id);
                                                                toast.success('Left group successfully');
                                                            } catch (error: unknown) {
                                                                const msg = error instanceof Error ? error.message : 'Failed to leave group';
                                                                toast.error(msg);
                                                            }
                                                        }
                                                    },
                                                });
                                            }}
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Display a few member avatars + per-group balance pill */}
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center -space-x-2">
                                        {group.members.slice(0, 4).map((m, idx) => (
                                            <Avatar key={m.user_id || idx} className="w-6 h-6 border-2 border-background">
                                                <AvatarImage src={m.avatar_url || ''} />
                                                <AvatarFallback className="text-[8px]">{m.full_name?.substring(0, 1) || '?'}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {group.members.length > 4 && (
                                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold border-2 border-background">
                                                +{group.members.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    {balance && (balance.owe > 0.01 || balance.owed > 0.01) ? (
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[10px] font-bold rounded-full px-2 py-0.5',
                                                balance.owe > 0.01
                                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                            )}
                                        >
                                            {balance.owe > 0.01
                                                ? `You owe ${formatCurrency(balance.owe)}`
                                                : `You're owed ${formatCurrency(balance.owed)}`}
                                        </Badge>
                                    ) : balance ? (
                                        <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-secondary/20 border-white/5 text-muted-foreground">
                                            Settled up
                                        </Badge>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            ) : (
                activeGroups.length === 0 && pastTrips.length === 0 && (
                    <Card className="bg-card/40 border-primary/20 overflow-hidden relative mx-4">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Users className="w-24 h-24" />
                        </div>
                        <CardContent className="p-5 relative z-10 text-center">
                            <h3 className="font-bold text-lg mb-1">No active groups</h3>
                            <p className="text-xs text-muted-foreground mb-4">Create a group to start splitting expenses with friends.</p>
                            <button
                                onClick={onStartGroup}
                                className="w-full bg-primary text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Start a Group
                            </button>
                            <Link
                                href="/guide#groups"
                                className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                            >
                                <BookOpen className="h-3 w-3" />
                                New here? Read about Groups &amp; friends
                            </Link>
                        </CardContent>
                    </Card>
                )
            )}

            {/* Past Trips Section */}
            {pastTrips.length > 0 && (
                <div className="pt-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-3">Past Trips</h3>
                    <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                        {pastTrips.map((group) => {
                            const Icon = getTypeIcon(group.type);
                            return (
                                <Card
                                    key={group.id}
                                    onClick={() => setSettingsGroupId(group.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSettingsGroupId(group.id);
                                        }
                                    }}
                                    className="bg-card/20 border-white/5 rounded-3xl overflow-hidden hover:bg-card/40 transition-colors cursor-pointer"
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-secondary/20 flex items-center justify-center grayscale">
                                                <Icon className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-muted-foreground line-through decoration-white/20">{group.name}</h4>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {group.end_date && `Ended ${format(parseDateOnly(group.end_date), 'MMM yyyy')}`}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
