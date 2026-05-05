import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Home, Plane, Heart, FileText, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import { useGroups, type Group, type GroupType, type Friend, type Split } from '@/components/providers/groups-provider';

interface GroupSettingsDialogProps {
    group: Group;
    friends: Friend[];
    currentUserId: string | null;
    pendingSplits: Split[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TYPE_OPTIONS: { id: GroupType; label: string; icon: React.ElementType; color: string; bg: string }[] = [
    { id: 'home', label: 'Home', icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { id: 'trip', label: 'Trip', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
    { id: 'couple', label: 'Couple', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
    { id: 'other', label: 'General', icon: FileText, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
];

export function GroupSettingsDialog({ group, friends, currentUserId, pendingSplits, open, onOpenChange }: GroupSettingsDialogProps) {
    const { updateGroup, deleteGroup, addMemberToGroup, removeGroupMember } = useGroups();

    const memberHasOpenSplits = (memberId: string) =>
        pendingSplits.some(s =>
            s.transaction?.group_id === group.id &&
            (s.user_id === memberId || s.transaction?.user_id === memberId)
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[420px] w-[95vw] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                <div className="p-6 space-y-5 w-full max-w-full overflow-hidden flex flex-col box-border">
                    <DialogHeader className="text-left px-0 w-full">
                        <DialogTitle>Group Settings</DialogTitle>
                        <DialogDescription className="truncate">
                            {isCreator ? 'Edit details, manage members, or delete.' : 'View members. Only the creator can edit.'}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[70vh] pr-1">
                        <div className="space-y-5">
                            {isCreator ? (
                                <>
                                    <div className="space-y-2">
                                        <label htmlFor="group-settings-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Name</label>
                                        <Input
                                            id="group-settings-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-secondary/20 border-white/5 h-11 rounded-2xl"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Type</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {TYPE_OPTIONS.map((option) => {
                                                const active = type === option.id;
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setType(option.id)}
                                                        className={cn(
                                                            'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all',
                                                            option.bg,
                                                            active ? 'ring-2 ring-primary/40 scale-[1.02]' : 'opacity-70 hover:opacity-100'
                                                        )}
                                                    >
                                                        <Icon className={cn('w-5 h-5', option.color)} />
                                                        <span className="text-[10px] font-bold">{option.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {type === 'trip' && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Dates</p>
                                            <DateRangePicker date={dateRange} setDate={setDateRange} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-1.5 p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                    <p className="text-base font-bold truncate">{group.name}</p>
                                    <p className="text-[11px] text-muted-foreground capitalize">
                                        {(group.type ?? 'other')}
                                        {group.type === 'trip' && group.start_date && (
                                            <> · trip dates set by creator</>
                                        )}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Members</p>
                                <div className="rounded-2xl border border-white/5 bg-secondary/10 p-2 space-y-1">
                                    {group.members.map((m) => {
                                        const isSelf = m.user_id === currentUserId;
                                        const canRemove = isCreator && !isSelf;
                                        return (
                                            <div key={m.user_id} className="flex items-center justify-between p-2 rounded-xl bg-card/30">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Avatar className="w-7 h-7">
                                                        <AvatarImage src={m.avatar_url || ''} />
                                                        <AvatarFallback className="text-[9px]">{m.full_name?.substring(0, 1) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-medium truncate">
                                                        {m.full_name || m.email}
                                                        {isSelf && <span className="text-muted-foreground"> (you)</span>}
                                                        {m.user_id === group.created_by && <span className="text-primary/70 ml-1">· creator</span>}
                                                    </span>
                                                </div>
                                                {canRemove && (
                                                    <button
                                                        className="p-1.5 rounded-full text-muted-foreground hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
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
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {isCreator && addableFriends.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Add friends</p>
                                    <div className="rounded-2xl border border-white/5 bg-secondary/10 p-2 space-y-1 max-h-40 overflow-y-auto">
                                        {addableFriends.map((friend) => (
                                            <div key={friend.id} className="flex items-center justify-between p-2 rounded-xl">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Avatar className="w-6 h-6">
                                                        <AvatarImage src={friend.avatar_url || ''} />
                                                        <AvatarFallback className="text-[8px]">{friend.full_name?.substring(0, 1)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-medium truncate">{friend.full_name || friend.email}</span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-[11px] text-primary hover:bg-primary/10 gap-1"
                                                    onClick={async () => {
                                                        try {
                                                            await addMemberToGroup(group.id, friend.id);
                                                            toast.success('Member added');
                                                        } catch (error: unknown) {
                                                            const msg = error instanceof Error ? error.message : 'Failed to add member';
                                                            toast.error(msg);
                                                        }
                                                    }}
                                                >
                                                    <UserPlus className="w-3 h-3" />
                                                    Add
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isCreator && (
                                <div className="pt-2 border-t border-white/5 space-y-2">
                                    <p className="text-xs font-bold text-rose-500/80 uppercase tracking-wider pl-1">Danger zone</p>
                                    <Button
                                        variant="ghost"
                                        onClick={handleDelete}
                                        className="w-full h-11 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 gap-2 border border-rose-500/20"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete group
                                    </Button>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {isCreator && (
                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="flex-1 h-11 rounded-xl"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!dirty || saving}
                                className="flex-[2] h-11 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save changes'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
