import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Copy, ScanLine, QrCode } from 'lucide-react';
import { NoviraQrCode } from '@/components/ui/qr-code';
import { QrScanner } from '@/components/ui/qr-scanner';
import { useGroupsActions } from '@/components/providers/groups-provider';
import { toast } from '@/utils/haptics';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';

interface AddFriendDialogProps {
    userId: string | null;
    /** When provided, the dialog is fully controlled and the default trigger button is hidden. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AddFriendDialog({ userId, open, onOpenChange }: AddFriendDialogProps) {
    const { addFriendByEmail, addFriendById } = useGroupsActions();
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
            toast.success('Friend request sent');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to add friend'));
        } finally {
            setIsProcessing(false);
        }
    };

    const triggerClasses = cn(
        'rounded-md text-[11px] font-medium tracking-tight h-7 data-[state=active]:text-primary text-muted-foreground/70 data-[state=active]:bg-primary/10 transition-colors gap-1.5',
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <button className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <UserPlus className="w-[18px] h-[18px]" />
                    </button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-[400px] w-[95vw] rounded-[28px] border-white/[0.08] bg-card/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
                <div className="p-5 space-y-4">
                    <DialogHeader className="text-left flex-row items-start gap-3 space-y-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/[0.06]">
                            <UserPlus className="w-[18px] h-[18px] text-primary" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-[15px] font-semibold tracking-tight">Add a friend</DialogTitle>
                            <DialogDescription className="text-[12px] mt-0.5">
                                By email, ID, or by scanning a code.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <Tabs defaultValue="email" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-secondary/15 p-0.5 rounded-lg h-8">
                            <TabsTrigger value="email" className={triggerClasses}>
                                <UserPlus className="w-3 h-3" />
                                Email
                            </TabsTrigger>
                            <TabsTrigger value="scan" className={triggerClasses}>
                                <ScanLine className="w-3 h-3" />
                                Scan
                            </TabsTrigger>
                            <TabsTrigger value="code" className={triggerClasses}>
                                <QrCode className="w-3 h-3" />
                                My code
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="email" className="space-y-3 pt-4 focus-visible:outline-none">
                            <Input
                                id="friend-email"
                                name="friend-email"
                                autoComplete="email"
                                placeholder="friend@example.com or user ID"
                                value={friendEmail}
                                onChange={(e) => setFriendEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddFriend();
                                }}
                                className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl"
                            />
                            <Button
                                onClick={handleAddFriend}
                                disabled={isProcessing || !friendEmail.trim()}
                                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors disabled:opacity-60"
                            >
                                {isProcessing ? 'Sending…' : 'Send request'}
                            </Button>
                        </TabsContent>

                        <TabsContent value="scan" className="pt-4 space-y-2 focus-visible:outline-none">
                            <div className="aspect-square w-full bg-black rounded-2xl overflow-hidden relative border border-white/[0.08]">
                                <QrScanner
                                    onScan={async (scannedId) => {
                                        if (isProcessing) return;
                                        setIsProcessing(true);
                                        try {
                                            await addFriendById(scannedId);
                                            setIsOpen(false);
                                            toast.success('Friend request sent');
                                        } catch (error) {
                                            const msg = getErrorMessage(error, 'Failed to add friend');
                                            if (msg !== 'You are already friends (or have a pending request) with this user') {
                                                toast.error(msg);
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
                                Align the QR code within the frame.
                            </p>
                        </TabsContent>

                        <TabsContent value="code" className="pt-4 flex flex-col items-center gap-4 focus-visible:outline-none">
                            <div className="p-3 rounded-3xl bg-white">
                                <NoviraQrCode value={userId || ''} width={200} height={200} />
                            </div>
                            <p className="text-[11px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
                                Have your friend scan this from their device.
                            </p>
                            <Button
                                variant="ghost"
                                className="h-9 rounded-full gap-1.5 text-[12px] font-medium text-primary hover:bg-primary/10"
                                onClick={() => {
                                    if (userId) {
                                        navigator.clipboard.writeText(userId);
                                        toast.success('Code copied');
                                    }
                                }}
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy my code
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
