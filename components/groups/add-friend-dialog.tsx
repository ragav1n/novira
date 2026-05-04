import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Copy } from 'lucide-react';
import { NoviraQrCode } from '@/components/ui/qr-code';
import { QrScanner } from '@/components/ui/qr-scanner';
import { useGroups } from '@/components/providers/groups-provider';
import { toast } from '@/utils/haptics';

interface AddFriendDialogProps {
    userId: string | null;
    /** When provided, the dialog is fully controlled and the default trigger button is hidden. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AddFriendDialog({ userId, open, onOpenChange }: AddFriendDialogProps) {
    const { addFriendByEmail, addFriendById } = useGroups();
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = isControlled ? open! : internalOpen;
    const setIsOpen = (next: boolean) => {
        if (isControlled) onOpenChange?.(next);
        else setInternalOpen(next);
    };
    const [friendEmail, setFriendEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAddFriend = async () => {
        const input = friendEmail.trim();
        if (!input || isProcessing) return;

        setIsProcessing(true);
        try {
            if (input.includes('@')) {
                await addFriendByEmail(input);
            } else {
                await addFriendById(input);
            }
            setFriendEmail('');
            setIsOpen(false);
            toast.success('Friend request sent!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add friend');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <button className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20">
                        <UserPlus className="w-5 h-5" />
                    </button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                    <DialogHeader className="text-left px-0 w-full">
                        <DialogTitle>Add Friend</DialogTitle>
                        <DialogDescription className="truncate">Add a friend by email or scan their code.</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="email" className="w-full mt-2">
                        <TabsList className="grid w-full grid-cols-3 bg-secondary/20 p-1 rounded-xl h-9">
                            <TabsTrigger value="email" className="rounded-lg text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Email / ID</TabsTrigger>
                            <TabsTrigger value="scan" className="rounded-lg text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Scan</TabsTrigger>
                            <TabsTrigger value="code" className="rounded-lg text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-white transition-all">My Code</TabsTrigger>
                        </TabsList>

                        <TabsContent value="email" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Input
                                    id="friend-email"
                                    name="friend-email"
                                    autoComplete="email"
                                    placeholder="friend@example.com or User ID"
                                    value={friendEmail}
                                    onChange={(e) => setFriendEmail(e.target.value)}
                                    className="bg-secondary/20 border-white/5 h-12 rounded-2xl"
                                />
                            </div>
                            <Button
                                onClick={handleAddFriend}
                                disabled={isProcessing}
                                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors"
                            >
                                {isProcessing ? 'Sending...' : 'Send Friend Request'}
                            </Button>
                        </TabsContent>

                        <TabsContent value="scan" className="py-4 space-y-2">
                            <div className="h-64 w-full bg-black rounded-2xl overflow-hidden relative border border-white/10">
                                <QrScanner
                                    onScan={async (scannedId) => {
                                        if (isProcessing) return;
                                        setIsProcessing(true);
                                        try {
                                            await addFriendById(scannedId);
                                            setIsOpen(false);
                                            toast.success('Friend request sent!');
                                        } catch (error: any) {
                                            if (error.message !== 'You are already friends (or have a pending request) with this user') {
                                                toast.error(error.message || 'Failed to add friend');
                                            } else {
                                                toast.info('Request already sent');
                                                setIsOpen(false);
                                            }
                                        } finally {
                                            setTimeout(() => setIsProcessing(false), 1000);
                                        }
                                    }}
                                    className="w-full h-full"
                                />
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground">
                                Align the QR code within the frame to scan.
                            </p>
                        </TabsContent>

                        <TabsContent value="code" className="py-6 space-y-6 flex flex-col items-center">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-pink-600 rounded-[2rem] blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                                <div className="relative">
                                    <NoviraQrCode value={userId || ''} width={220} height={220} />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center px-4 max-w-[200px] leading-relaxed">
                                Let your friend scan this code to add you instantly.
                            </p>
                            <Button
                                variant="outline"
                                className="h-10 rounded-xl gap-2 text-xs border-white/10"
                                onClick={() => {
                                    if (userId) {
                                        navigator.clipboard.writeText(userId);
                                        toast.success('User ID copied to clipboard');
                                    }
                                }}
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy My Code
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
