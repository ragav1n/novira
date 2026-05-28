import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Home, Plane, Heart, FileText, Trash2, UserMinus, UserPlus, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import { useGroupsActions, type Group, type GroupType, type Friend, type Split } from '@/components/providers/groups-provider';

interface GroupSettingsDialogProps {
    group: Group;
    friends: Friend[];
    currentUserId: string | null;
    pendingSplits: Split[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TYPE_OPTIONS: { id: GroupType; label: string; icon: React.ElementType; tint: string; bg: string }[] = [
    { id: 'home', label: 'Home', icon: Home, tint: 'text-emerald-400', bg: 'bg-emerald-400/[0.08]' },
    { id: 'trip', label: 'Trip', icon: Plane, tint: 'text-sky-400', bg: 'bg-sky-400/[0.08]' },
    { id: 'couple', label: 'Couple', icon: Heart, tint: 'text-rose-400', bg: 'bg-rose-400/[0.08]' },
    { id: 'other', label: 'General', icon: FileText, tint: 'text-primary', bg: 'bg-primary/[0.08]' },
];

export function GroupSettingsDialog({ group, friends, currentUserId, pendingSplits, open, onOpenChange }: GroupSettingsDialogProps) {
    const { updateGroup, deleteGroup, addMemberToGroup, removeGroupMember } = useGroupsActions();

    const memberHasOpenSplits = (memberId: string) =>
        pendingSplits.some(s =>
            s.transaction?.group_id === group.id &&
            (s.user_id === memberId || s.transaction?.user_id === memberId),
        );

    const isCreator = group.created_by === currentUserId;

    const [name, setName] = useState(group.name);
    const [type, setType] = useState<GroupType>(group.type ?? 'other');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
        from: group.start_date ? new Date(group.start_date) : undefined,
        to: group.end_date ? new Date(group.end_date) : undefined,
    }));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(group.name);
        setType(group.type ?? 'other');
        setDateRange({
            from: group.start_date ? new Date(group.start_date) : undefined,
            to: group.end_date ? new Date(group.end_date) : undefined,
        });
    }, [open, group]);

    const dirty =
        name.trim() !== group.name ||
        type !== (group.type ?? 'other') ||
        (type === 'trip' && (
            (dateRange?.from?.toISOString() ?? null) !== (group.start_date ?? null) ||
            (dateRange?.to?.toISOString() ?? null) !== (group.end_date ?? null)
        ));

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Name is required');
            return;
        }
        setSaving(true);
        try {
            await updateGroup(group.id, {
                name: name.trim(),
                type,
                start_date: type === 'trip' && dateRange?.from ? dateRange.from.toISOString() : null,
                end_date: type === 'trip' && dateRange?.to ? dateRange.to.toISOString() : null,
            });
            toast.success('Group updated');
            onOpenChange(false);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to update group';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        toast(`Delete ${group.name}?`, {
            description: 'Members are removed and shared expenses become personal. This cannot be undone.',
            action: {
                label: 'Delete',
                onClick: async () => {
                    try {
                        await deleteGroup(group.id);
                        toast.success('Group deleted');
                        onOpenChange(false);
                    } catch (error: unknown) {
                        const msg = error instanceof Error ? error.message : 'Failed to delete group';
                        toast.error(msg);
                    }
                },
            },
        });
    };

    const addableFriends = friends.filter(f => !group.members.some(m => m.user_id === f.id));
    const selectedType = TYPE_OPTIONS.find(t => t.id === type) || TYPE_OPTIONS[3];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[420px] w-[95vw] rounded-[28px] border-white/[0.08] bg-card/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
                <div className="p-5 space-y-4">
                    <DialogHeader className="text-left flex-row items-start gap-3 space-y-0">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', selectedType.bg)}>
                            <Settings2 className={cn('w-[18px] h-[18px]', selectedType.tint)} />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-[15px] font-semibold tracking-tight truncate">Group settings</DialogTitle>
                            <DialogDescription className="text-[12px] mt-0.5 truncate">
                                {isCreator ? 'Edit details, manage members, or delete.' : 'View members. Only the creator can edit.'}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="max-h-[68vh] pr-1 -mr-1">
                        <div className="space-y-4">
                            {isCreator ? (
                                <>
                                    <div className="space-y-1.5">
                                        <label htmlFor="group-settings-name" className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                            Name
                                        </label>
                                        <Input
                                            id="group-settings-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                            Type
                                        </p>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {TYPE_OPTIONS.map((option) => {
                                                const active = type === option.id;
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setType(option.id)}
                                                        className={cn(
                                                            'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border transition-colors',
                                                            active
                                                                ? cn(option.bg, 'border-white/[0.08]')
                                                                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]',
                                                        )}
                                                    >
                                                        <Icon className={cn('w-4 h-4', active ? option.tint : 'text-muted-foreground/60')} />
                                                        <span className={cn(
                                                            'text-[10px] font-medium',
                                                            active ? option.tint : 'text-muted-foreground',
                                                        )}>{option.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {type === 'trip' && (
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                                Dates
                                            </p>
                                            <DateRangePicker date={dateRange} setDate={setDateRange} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                                    <p className="text-[14px] font-semibold truncate">{group.name}</p>
                                    <p className="text-[11px] text-muted-foreground capitalize">
                                        {(group.type ?? 'other')}
                                        {group.type === 'trip' && group.start_date && (
                                            <> · trip dates set by creator</>
                                        )}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                    Members · {group.members.length}
                                </p>
                                <ul className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                                    {group.members.map((m) => {
                                        const isSelf = m.user_id === currentUserId;
                                        const canRemove = isCreator && !isSelf;
                                        return (
                                            <li key={m.user_id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.025]">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Avatar className="w-7 h-7">
                                                        <AvatarImage src={m.avatar_url || ''} />
                                                        <AvatarFallback className="text-[9px]">{m.full_name?.substring(0, 1) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[12px] font-medium truncate">
                                                        {m.full_name || m.email}
                                                        {isSelf && <span className="text-muted-foreground"> (you)</span>}
                                                        {m.user_id === group.created_by && <span className="text-primary/70 ml-1">· creator</span>}
                                                    </span>
                                                </div>
                                                {canRemove && (
                                                    <button
                                                        type="button"
                                                        className="p-1.5 rounded-full text-muted-foreground/60 hover:bg-rose-400/10 hover:text-rose-400 transition-colors"
                                                        title="Remove from group"
                                                        onClick={() => {
                                                            const hasOpen = memberHasOpenSplits(m.user_id);
                                                            const promptMsg = hasOpen
                                                                ? `${m.full_name || 'Member'} has unsettled splits in this group. Remove anyway?`
                                                                : `Remove ${m.full_name || 'member'}?`;
                                                            toast(promptMsg, {
                                                                description: hasOpen ? 'Unsettled splits stay open and visible in Settlements.' : undefined,
                                                                action: {
                                                                    label: 'Remove',
                                                                    onClick: async () => {
                                                                        try {
                                                                            await removeGroupMember(group.id, m.user_id);
                                                                            toast.success('Member removed');
                                                                        } catch (error: unknown) {
                                                                            const msg = error instanceof Error ? error.message : 'Failed to remove member';
                                                                            toast.error(msg);
                                                                        }
                                                                    },
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            {isCreator && addableFriends.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                        Add friends
                                    </p>
                                    <ul className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04] max-h-40 overflow-y-auto">
                                        {addableFriends.map((friend) => (
                                            <li key={friend.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.025]">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Avatar className="w-6 h-6">
                                                        <AvatarImage src={friend.avatar_url || ''} />
                                                        <AvatarFallback className="text-[8px]">{friend.full_name?.substring(0, 1)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[12px] font-medium truncate">{friend.full_name || friend.email}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await addMemberToGroup(group.id, friend.id);
                                                            toast.success('Member added');
                                                        } catch (error: unknown) {
                                                            const msg = error instanceof Error ? error.message : 'Failed to add member';
                                                            toast.error(msg);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                                >
                                                    <UserPlus className="w-3 h-3" />
                                                    Add
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {isCreator && (
                                <div className="pt-2 mt-1 border-t border-white/[0.05] space-y-1.5">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-rose-400/70 pl-1">Danger zone</p>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-rose-400/[0.06] text-rose-300 hover:bg-rose-400/10 border border-rose-400/15 text-[12px] font-semibold transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete group
                                    </button>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {isCreator && (
                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="h-11 rounded-xl text-muted-foreground hover:text-foreground"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!dirty || saving}
                                className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save changes'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
