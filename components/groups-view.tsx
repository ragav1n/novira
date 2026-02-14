'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft, Plus, Users, UserPlus, ArrowUpRight, ArrowDownLeft,
    Search, Mail, Check, X, Shield, MoreVertical, LogOut, ArrowRight, UserMinus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useGroups } from './providers/groups-provider';
import { useUserPreferences } from './providers/user-preferences-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from 'sonner';

export function GroupsView() {
    const router = useRouter();
    const { groups, friends, friendRequests, balances, pendingSplits, createGroup, addFriendByEmail, addMemberToGroup, settleSplit, acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend } = useGroups();
    const { formatCurrency, userId } = useUserPreferences();

    const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
    const [friendEmail, setFriendEmail] = useState('');

    // Member management state
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await createGroup(newGroupName);
            setNewGroupName('');
            setIsAddGroupOpen(false);
            toast.success('Group created successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create group');
        }
    };

    const handleAddFriend = async () => {
        if (!friendEmail.trim()) return;
        try {
            await addFriendByEmail(friendEmail);
            setFriendEmail('');
            setIsAddFriendOpen(false);
            toast.success('Friend request sent!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add friend');
        }
    };

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
            {/* Header */}
            <div className="flex items-center justify-between relative">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">Groups & Friends</h2>
                <div className="flex gap-2">
                    <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                        <DialogTrigger asChild>
                            <button className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20">
                                <UserPlus className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[340px] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl">
                            <DialogHeader>
                                <DialogTitle>Add Friend</DialogTitle>
                                <DialogDescription>Enter your friend's email to find them.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="friend@example.com"
                                        value={friendEmail}
                                        onChange={(e) => setFriendEmail(e.target.value)}
                                        className="bg-secondary/20 border-white/5 h-12 rounded-2xl"
                                    />
                                </div>
                                <Button onClick={handleAddFriend} className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/80 text-white font-bold">
                                    Send Friend Request
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                        <DialogTrigger asChild>
                            <button className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20">
                                <Plus className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[340px] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl">
                            <DialogHeader>
                                <DialogTitle>Create Group</DialogTitle>
                                <DialogDescription>Give your group a name to get started.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="e.g. Goa Trip, Flatmates"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="bg-secondary/20 border-white/5 h-12 rounded-2xl"
                                    />
                                </div>
                                <Button onClick={handleCreateGroup} className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/80 text-white font-bold">
                                    Create Group
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Balance Overview */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-500/10 border-emerald-500/20 rounded-3xl">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center" id="owed-to-me-section">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">You are owed</p>
                        <h4 className="text-xl font-bold text-emerald-500">{formatCurrency(balances.totalOwedToMe)}</h4>
                    </CardContent>
                </Card>
                <Card className="bg-rose-500/10 border-rose-500/20 rounded-3xl">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center" id="i-owe-section">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
                            <ArrowUpRight className="w-5 h-5 text-rose-500" />
                        </div>
                        <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">You owe</p>
                        <h4 className="text-xl font-bold text-rose-500">{formatCurrency(balances.totalOwed)}</h4>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="groups" className="w-full">
                <TabsList className="w-full grid grid-cols-3 bg-secondary/20 p-1 rounded-2xl h-12">
                    <TabsTrigger value="groups" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold">Groups</TabsTrigger>
                    <TabsTrigger value="friends" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold">Friends</TabsTrigger>
                    <TabsTrigger value="settlements" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold italic text-xs">Settlements</TabsTrigger>
                </TabsList>

                <TabsContent value="groups" className="mt-6 space-y-4">
                    {groups.length > 0 ? (
                        groups.map((group) => (
                            <Card key={group.id} className="bg-card/40 border-white/5 rounded-3xl overflow-hidden hover:bg-card/60 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                                                <Users className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-base">{group.name}</h4>
                                                <p className="text-xs text-muted-foreground">{group.members.length} members</p>
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
                                                <DialogContent className="max-w-[340px] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Manage Members</DialogTitle>
                                                        <DialogDescription>Add friends to {group.name}</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Your Friends</div>
                                                        <ScrollArea className="h-48 rounded-2xl border border-white/5 p-2">
                                                            <div className="space-y-2">
                                                                {friends.filter(f => !group.members.some(m => m.user_id === f.id)).map(friend => (
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
                                                                            className="h-7 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
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
                                                                {friends.filter(f => !group.members.some(m => m.user_id === f.id)).length === 0 && (
                                                                    <p className="text-[10px] text-center text-muted-foreground p-4">No more friends to add.</p>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mt-4">Current Members</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {group.members.map(m => (
                                                                <Badge key={m.user_id} variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                                                                    {m.full_name || 'You'}
                                                                </Badge>
                                                            ))}
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
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                                <Users className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm text-muted-foreground">No groups yet. Create one to split expenses!</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="friends" className="mt-6 space-y-4">
                    {/* Friend Requests Section */}
                    {friendRequests.length > 0 && (
                        <div className="space-y-3 mb-6">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Friend Requests</h3>
                            {friendRequests.map((request) => (
                                <div key={request.id} className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-10 h-10 border border-primary/20">
                                            <AvatarImage src={request.avatar_url || ''} />
                                            <AvatarFallback className="text-xs font-bold text-primary">{request.full_name?.substring(0, 2) || request.email?.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-bold">{request.full_name || request.email?.split('@')[0]}</p>
                                            <p className="text-[10px] text-muted-foreground">{request.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 rounded-full hover:bg-rose-500/20 hover:text-rose-500 text-muted-foreground"
                                            onClick={async () => {
                                                try {
                                                    if (request.request_id) {
                                                        await declineFriendRequest(request.request_id);
                                                        toast.success('Request declined');
                                                    }
                                                } catch (error: any) {
                                                    toast.error('Failed to decline');
                                                }
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-[10px] rounded-full bg-primary text-white hover:bg-primary/90"
                                            onClick={async () => {
                                                try {
                                                    if (request.request_id) {
                                                        await acceptFriendRequest(request.request_id);
                                                        toast.success('Friend added!');
                                                    }
                                                } catch (error: any) {
                                                    toast.error('Failed to accept');
                                                    console.error(error);
                                                }
                                            }}
                                        >
                                            Accept
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Friends List */}
                    {friends.length > 0 ? (
                        friends.map((friend) => (
                            <div key={friend.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10 border border-white/10">
                                        <AvatarImage src={friend.avatar_url || ''} />
                                        <AvatarFallback className="text-xs font-bold">{friend.full_name?.substring(0, 2) || friend.email?.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-bold">{friend.full_name || friend.email?.split('@')[0]}</p>
                                        <p className="text-[10px] text-muted-foreground">{friend.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Status Badge */}
                                    <Badge variant="outline" className="text-[8px] uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
                                        Active
                                    </Badge>
                                    <button
                                        className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors text-muted-foreground"
                                        title="Remove Friend"
                                        onClick={() => {
                                            toast(`Remove ${friend.full_name || 'friend'}?`, {
                                                action: {
                                                    label: 'Remove',
                                                    onClick: async () => {
                                                        try {
                                                            if (friend.request_id) {
                                                                await removeFriend(friend.request_id);
                                                                toast.success('Friend removed');
                                                            }
                                                        } catch (error: any) {
                                                            toast.error(error.message || 'Failed to remove friend');
                                                        }
                                                    }
                                                },
                                            });
                                        }}
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                                <UserPlus className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm text-muted-foreground">Add friends by email to start splitting.</p>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="settlements" className="mt-6 space-y-4">
                    {pendingSplits.length > 0 ? (
                        pendingSplits.map((split) => {
                            const isDebtor = split.user_id === userId;
                            return (
                                <div key={split.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center border",
                                            isDebtor ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                                        )}>
                                            {isDebtor ? <ArrowUpRight className="w-5 h-5 text-rose-500" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{split.transaction?.description}</p>
                                            <p className="text-[10px] text-muted-foreground italic">
                                                {isDebtor ? `You owe ${split.transaction?.payer_name}` : `${split.transaction?.payer_name} owes you`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={cn(
                                            "font-bold text-sm",
                                            isDebtor ? "text-rose-500" : "text-emerald-500"
                                        )}>
                                            {isDebtor ? '-' : '+'}{formatCurrency(split.amount)}
                                        </span>
                                        <Button
                                            size="sm"
                                            className="h-7 text-[10px] rounded-full bg-primary/20 text-primary border border-primary/20 hover:bg-primary/30"
                                            onClick={async () => {
                                                try {
                                                    await settleSplit(split.id);
                                                    toast.success('Split settled!');
                                                } catch (error: any) {
                                                    toast.error(error.message || 'Failed to settle split');
                                                }
                                            }}
                                        >
                                            Settle
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-emerald-500/30" />
                            </div>
                            <p className="text-sm text-muted-foreground">All settled up! No pending payments.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
