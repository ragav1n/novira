import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Plus, Users, UserPlus, LogOut, FileText, Home, Plane, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';

interface GroupsTabContentProps {
    groups: any[];
    friends: any[];
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
    groups, friends, addMemberToGroup, leaveGroup, onStartGroup
}: GroupsTabContentProps) {
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const sortedGroups = [...groups].sort((a, b) => {
        if (a.type === 'home' && b.type !== 'home') return -1;
        if (a.type !== 'home' && b.type === 'home') return 1;
        const aIsTrip = a.type === 'trip';
        const bIsTrip = b.type === 'trip';
        const now = new Date();
        const aIsPastTrip = aIsTrip && a.end_date && new Date(a.end_date) < now;
        const bIsPastTrip = bIsTrip && b.end_date && new Date(b.end_date) < now;

        if (aIsPastTrip && !bIsPastTrip) return 1;
        if (!aIsPastTrip && bIsPastTrip) return -1;

        if (aIsTrip && bIsTrip && !aIsPastTrip && !bIsPastTrip) {
            if (a.start_date && b.start_date) {
                return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
            }
        }
        return 0;
    });

    const activeGroups = sortedGroups.filter(g => {
        if (g.type !== 'trip') return true;
        if (!g.end_date) return true;
        return new Date(g.end_date) >= new Date();
    });

    const pastTrips = sortedGroups.filter(g => {
        if (g.type !== 'trip') return false;
        return g.end_date && new Date(g.end_date) < new Date();
    });

    return (
        <div className="mt-6 space-y-4">
            {activeGroups.length > 0 ? (
                activeGroups.map((group) => {
                    const Icon = getTypeIcon(group.type);
                    const isHome = group.type === 'home';
                    const isTrip = group.type === 'trip';
                    const isCouple = group.type === 'couple';

                    return (
                        <Card key={group.id} className={cn(
                            "rounded-3xl overflow-hidden hover:bg-card/60 transition-colors border-white/5",
                            isHome ? "bg-emerald-500/5 border-emerald-500/10" : "bg-card/40"
                        )}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center border",
                                            isHome ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                isTrip ? "bg-sky-500/10 border-sky-500/20 text-sky-500" :
                                                    isCouple ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                                                        "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/20 text-primary"
                                        )}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-base">{group.name}</h4>
                                                {isHome && <Badge variant="secondary" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1.5">HOME</Badge>}
                                            </div>

                                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                                                {isTrip && group.start_date && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                                        <span className="text-sky-500/80 font-medium">
                                                            {format(new Date(group.start_date), 'MMM d')}
                                                            {group.end_date && ` - ${format(new Date(group.end_date), 'MMM d')}`}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Dialog open={isManageMembersOpen && selectedGroupId === group.id} onOpenChange={(open) => {
                                            setIsManageMembersOpen(open);
                                            if (open) setSelectedGroupId(group.id);
                                        }}>
                                            <DialogTrigger asChild>
                                                <button className="p-2 rounded-full hover:bg-secondary/30 transition-colors" title="Manage Members">
                                                    <UserPlus className="w-4 h-4 text-primary" />
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                                                <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                                                    <DialogHeader className="text-left px-0 w-full">
                                                        <DialogTitle>Manage Members</DialogTitle>
                                                        <DialogDescription className="truncate">Add friends to {group.name}</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Your Friends</div>
                                                        <ScrollArea className="h-48 rounded-2xl border border-white/5 p-2">
                                                            <div className="space-y-2">
                                                                {friends.filter((f: any) => !group.members.some((m: any) => m.user_id === f.id)).map((friend: any) => (
                                                                    <div key={friend.id} className="flex items-center justify-between p-2 rounded-xl bg-secondary/10">
                                                                        <div className="flex items-center gap-2">
                                                                            <Avatar className="w-6 h-6">
                                                                                <AvatarImage src={friend.avatar_url || ''} />
                                                                                <AvatarFallback className="text-[8px]">{friend.full_name?.substring(0, 1)}</AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="text-xs font-medium">{friend.full_name || friend.email}</span>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await addMemberToGroup(group.id, friend.id);
                                                                                    toast.success('Member added to group!');
                                                                                } catch (error: any) {
                                                                                    toast.error(error.message || 'Failed to add member');
                                                                                }
                                                                            }}
                                                                        >
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                                {friends.filter((f: any) => !group.members.some((m: any) => m.user_id === f.id)).length === 0 && (
                                                                    <p className="text-[11px] text-center text-muted-foreground p-4">No more friends to add.</p>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mt-4">Current Members</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {group.members.map((m: any) => (
                                                                <Badge key={m.user_id} variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                                                                    {m.full_name || 'You'}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                        <button
                                            className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                            title="Leave Group"
                                            onClick={() => {
                                                toast(`Leave ${group.name}?`, {
                                                    action: {
                                                        label: 'Leave',
                                                        onClick: async () => {
                                                            try {
                                                                await leaveGroup(group.id);
                                                                toast.success('Left group successfully');
                                                            } catch (error: any) {
                                                                toast.error(error.message || 'Failed to leave group');
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

                                {/* Display a few member avatars */}
                                <div className="flex items-center mt-4 -space-x-2">
                                    {group.members.slice(0, 4).map((m: any, idx: number) => (
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
                                <Card key={group.id} className="bg-card/20 border-white/5 rounded-3xl overflow-hidden hover:bg-card/40 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-secondary/20 flex items-center justify-center grayscale">
                                                <Icon className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-muted-foreground line-through decoration-white/20">{group.name}</h4>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {group.end_date && `Ended ${format(new Date(group.end_date), 'MMM yyyy')}`}
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
