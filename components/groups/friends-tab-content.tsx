import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, UserPlus, UserMinus } from 'lucide-react';
import { toast } from '@/utils/haptics';

interface FriendsTabContentProps {
    friendRequests: any[];
    friends: any[];
    acceptFriendRequest: (requestId: string) => Promise<void>;
    declineFriendRequest: (requestId: string) => Promise<void>;
    removeFriend: (requestId: string) => Promise<void>;
}

export function FriendsTabContent({
    friendRequests, friends, acceptFriendRequest, declineFriendRequest, removeFriend
}: FriendsTabContentProps) {
    return (
        <div className="mt-6 space-y-4">
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
                <div className="space-y-3 mb-6">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Friend Requests</h3>
                    {friendRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="w-10 h-10 border border-primary/20 shrink-0">
                                    <AvatarImage src={request.avatar_url || ''} />
                                    <AvatarFallback className="text-xs font-bold text-primary">{request.full_name?.substring(0, 2) || request.email?.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">{request.full_name || request.email?.split('@')[0]}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{request.email}</p>
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
                                    className="h-7 text-[11px] rounded-full bg-primary text-white hover:bg-primary/90"
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
                    <div key={friend.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                                <AvatarImage src={friend.avatar_url || ''} />
                                <AvatarFallback className="text-xs font-bold">{friend.full_name?.substring(0, 2) || friend.email?.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{friend.full_name || friend.email?.split('@')[0]}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{friend.email}</p>
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
                <Card className="bg-card/40 border-primary/20 overflow-hidden relative mx-4">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <UserPlus className="w-24 h-24" />
                    </div>
                    <CardContent className="p-5 relative z-10 text-center">
                        <h3 className="font-bold text-lg mb-1">No friends yet</h3>
                        <p className="text-xs text-muted-foreground mb-4">Add some friends to start splitting expenses.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
