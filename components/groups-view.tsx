'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft, Plus, Users, UserPlus, ArrowUpRight, ArrowDownLeft,
    Search, Mail, Check, X, Shield, MoreVertical, LogOut, ArrowRight, UserMinus,
    Home, Plane, Heart, FileText, Calendar as CalendarIcon, Copy, Scan, QrCode,
    Tag, Archive, Trash2, Settings2, Target, History, Gift, Car, Utensils, ShoppingCart,
    Stethoscope, Gamepad2, School, Laptop, Music, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useGroups } from './providers/groups-provider';
import { useUserPreferences } from './providers/user-preferences-provider';
import { useBuckets, Bucket } from './providers/buckets-provider';
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
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format, differenceInDays } from 'date-fns';
import { NoviraQrCode } from '@/components/ui/qr-code';
import { QrScanner } from '@/components/ui/qr-scanner';

export function GroupsView() {
    const router = useRouter();
    const { groups, friends, friendRequests, balances, pendingSplits, createGroup, addFriendByEmail, addFriendById, addMemberToGroup, settleSplit, acceptFriendRequest, declineFriendRequest, leaveGroup, removeFriend } = useGroups();
    const { formatCurrency, userId, currency, convertAmount } = useUserPreferences();

    const { buckets, createBucket, updateBucket, archiveBucket, deleteBucket, bucketSpending, loading: bucketsLoading } = useBuckets();

    const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
    const [creationStep, setCreationStep] = useState<'type' | 'details'>('type');
    const [selectedType, setSelectedType] = useState<'home' | 'trip' | 'couple' | 'other' | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
    const [friendEmail, setFriendEmail] = useState('');

    // Bucket management state
    const [isAddBucketOpen, setIsAddBucketOpen] = useState(false);
    const [isEditBucketOpen, setIsEditBucketOpen] = useState(false);
    const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
    const [newBucketName, setNewBucketName] = useState('');
    const [newBucketTarget, setNewBucketTarget] = useState('');
    const [newBucketIcon, setNewBucketIcon] = useState('Tag');
    const [bucketDateRange, setBucketDateRange] = useState<DateRange | undefined>();

    // Member management state
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        if (!selectedType) {
            toast.error('Please select a group type');
            return;
        }

        try {
            await createGroup(newGroupName, selectedType, dateRange?.from, dateRange?.to);
            setNewGroupName('');
            setSelectedType(null);
            setDateRange(undefined);
            setCreationStep('type');
            setIsAddGroupOpen(false);
            toast.success('Group created successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create group');
        }
    };

    const handleAddFriend = async () => {
        const input = friendEmail.trim();
        if (!input || isProcessing) return;

        setIsProcessing(true);
        try {
            if (input.includes('@')) {
                await addFriendByEmail(input);
            } else {
                // Assume it's an ID
                await addFriendById(input);
            }
            setFriendEmail('');
            setIsAddFriendOpen(false);
            toast.success('Friend request sent!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add friend');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateBucket = async () => {
        if (!newBucketName.trim()) {
            toast.error('Please enter a bucket name');
            return;
        }

        setIsProcessing(true);
        try {
            await createBucket({
                name: newBucketName,
                budget: parseFloat(newBucketTarget) || 0,
                icon: newBucketIcon,
                type: 'trip',
                start_date: bucketDateRange?.from?.toISOString(),
                end_date: bucketDateRange?.to?.toISOString()
            });
            setIsAddBucketOpen(false);
            setNewBucketName('');
            setNewBucketTarget('');
            setNewBucketIcon('Tag');
            setBucketDateRange(undefined);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bucket');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateBucket = async () => {
        if (!editingBucket || !newBucketName.trim()) return;

        setIsProcessing(true);
        try {
            await updateBucket(editingBucket.id, {
                name: newBucketName,
                budget: parseFloat(newBucketTarget) || 0,
                icon: newBucketIcon,
                start_date: bucketDateRange?.from?.toISOString(),
                end_date: bucketDateRange?.to?.toISOString()
            });
            setIsEditBucketOpen(false);
            setEditingBucket(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update bucket');
        } finally {
            setIsProcessing(false);
        }
    };

    const getBucketIcon = (iconName?: string) => {
        const icons: Record<string, any> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-5 h-5" />;
    };

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case 'home': return Home;
            case 'trip': return Plane;
            case 'couple': return Heart;
            default: return FileText;
        }
    };

    const sortedGroups = [...groups].sort((a, b) => {
        // 1. Home groups first
        if (a.type === 'home' && b.type !== 'home') return -1;
        if (a.type !== 'home' && b.type === 'home') return 1;

        // 2. Active Trips (future/current start date) vs Others
        const aIsTrip = a.type === 'trip';
        const bIsTrip = b.type === 'trip';

        // 3. Past Trips last
        const now = new Date();
        const aIsPastTrip = aIsTrip && a.end_date && new Date(a.end_date) < now;
        const bIsPastTrip = bIsTrip && b.end_date && new Date(b.end_date) < now;

        if (aIsPastTrip && !bIsPastTrip) return 1;
        if (!aIsPastTrip && bIsPastTrip) return -1;

        // Sort active trips by start date
        if (aIsTrip && bIsTrip && !aIsPastTrip && !bIsPastTrip) {
            if (a.start_date && b.start_date) {
                return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
            }
        }

        return 0;
    });

    const activeGroups = sortedGroups.filter(g => {
        if (g.type !== 'trip') return true;
        // Keep active trips here
        if (!g.end_date) return true;
        return new Date(g.end_date) >= new Date();
    });

    const pastTrips = sortedGroups.filter(g => {
        if (g.type !== 'trip') return false;
        return g.end_date && new Date(g.end_date) < new Date();
    });

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
            {/* Header */}
            <div className="flex items-center justify-between relative">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0 px-2">
                    <h2 className="text-lg font-semibold truncate">Groups & Friends</h2>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                        <DialogTrigger asChild>
                            <button className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20">
                                <UserPlus className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                            <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                                <DialogHeader className="text-left px-0 w-full">
                                    <DialogTitle>Add Friend</DialogTitle>
                                    <DialogDescription className="truncate">Add a friend by email or scan their code.</DialogDescription>
                                </DialogHeader>

                                <Tabs defaultValue="email" className="w-full mt-2">
                                    <TabsList className="grid w-full grid-cols-3 bg-secondary/20 p-1 rounded-xl h-9">
                                        <TabsTrigger value="email" className="rounded-lg text-xs font-medium">Email / ID</TabsTrigger>
                                        <TabsTrigger value="scan" className="rounded-lg text-xs font-medium">Scan</TabsTrigger>
                                        <TabsTrigger value="code" className="rounded-lg text-xs font-medium">My Code</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="email" className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Input
                                                placeholder="friend@example.com or User ID"
                                                value={friendEmail}
                                                onChange={(e) => setFriendEmail(e.target.value)}
                                                className="bg-secondary/20 border-white/5 h-12 rounded-2xl"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleAddFriend}
                                            disabled={isProcessing}
                                            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/80 text-white font-bold"
                                        >
                                            {isProcessing ? 'Sending...' : 'Send Friend Request'}
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="scan" className="py-4 space-y-2">
                                        <div className="h-64 w-full bg-black rounded-2xl overflow-hidden relative border border-white/10">
                                            <QrScanner
                                                onScan={async (scannedId) => {
                                                    if (isProcessing) return;
                                                    // Scanned ID handled

                                                    setIsProcessing(true);
                                                    try {
                                                        await addFriendById(scannedId);
                                                        setIsAddFriendOpen(false);
                                                        toast.success('Friend request sent!');
                                                    } catch (error: any) {
                                                        // Ignore duplicate requests silently if they happen very fast or show error
                                                        if (error.message !== 'You are already friends (or have a pending request) with this user') {
                                                            toast.error(error.message || 'Failed to add friend');
                                                        } else {
                                                            // It's a duplicate, maybe just close dialog to avoid confusion or show success
                                                            toast.info('Request already sent');
                                                            setIsAddFriendOpen(false);
                                                        }
                                                    } finally {
                                                        // Small delay before allowing next scan if we didn't close dialog
                                                        setTimeout(() => setIsProcessing(false), 1000);
                                                    }
                                                }}
                                                className="w-full h-full"
                                            />
                                        </div>
                                        <p className="text-[10px] text-center text-muted-foreground">
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

                    <Dialog
                        open={isAddBucketOpen || isEditBucketOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setIsAddBucketOpen(false);
                                setIsEditBucketOpen(false);
                                setEditingBucket(null);
                                setNewBucketName('');
                                setNewBucketTarget('');
                                setNewBucketIcon('Tag');
                                setBucketDateRange(undefined);
                            }
                        }}
                    >
                        <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                            <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                                <DialogHeader className="text-left px-0">
                                    <DialogTitle>{isEditBucketOpen ? 'Edit Bucket' : 'Create Bucket'}</DialogTitle>
                                    <DialogDescription>{isEditBucketOpen ? 'Modify your bucket details.' : 'Organize your private spending.'}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-3 w-full overflow-hidden">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Select Icon</label>
                                        <div className="flex gap-2 overflow-x-auto pb-4 px-1 w-full -mb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                            {[
                                                { name: 'Tag', icon: Tag },
                                                { name: 'Plane', icon: Plane },
                                                { name: 'Home', icon: Home },
                                                { name: 'Gift', icon: Gift },
                                                { name: 'Car', icon: Car },
                                                { name: 'Utensils', icon: Utensils },
                                                { name: 'ShoppingCart', icon: ShoppingCart },
                                                { name: 'Heart', icon: Heart },
                                                { name: 'Gamepad2', icon: Gamepad2 },
                                                { name: 'Music', icon: Music },
                                                { name: 'Laptop', icon: Laptop },
                                                { name: 'School', icon: School },
                                            ].map(item => (
                                                <button
                                                    key={item.name}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setNewBucketIcon(item.name);
                                                    }}
                                                    className={cn(
                                                        "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-all",
                                                        newBucketIcon === item.name
                                                            ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                            : "bg-secondary/10 border-white/5 text-muted-foreground hover:border-white/10"
                                                    )}
                                                >
                                                    <item.icon className="w-5 h-5 pointer-events-none" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-left w-full">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Bucket Name</label>
                                        <Input
                                            placeholder="e.g. Trip, New iPhone, Gift..."
                                            value={newBucketName}
                                            onChange={(e) => setNewBucketName(e.target.value)}
                                            className="bg-secondary/20 border-white/5 h-12 rounded-2xl focus-visible:ring-amber-500/50 w-full"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2 text-left w-full">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Total Budget</label>
                                            <div className="relative w-full">
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={newBucketTarget}
                                                    onChange={(e) => setNewBucketTarget(e.target.value)}
                                                    className="bg-secondary/20 border-white/5 h-12 rounded-2xl pl-8 focus-visible:ring-amber-500/50 w-full"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                                                    {currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : '$'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-left w-full">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Dates</label>
                                            <DateRangePicker
                                                date={bucketDateRange}
                                                setDate={setBucketDateRange}
                                                className="h-12"
                                                numberOfMonths={1}
                                                align="center"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={isEditBucketOpen ? handleUpdateBucket : handleCreateBucket}
                                        disabled={isProcessing}
                                        className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/20 mt-4 text-sm"
                                    >
                                        {isProcessing ? 'Processing...' : isEditBucketOpen ? 'Save Changes' : 'Create Bucket'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog
                        open={isAddGroupOpen}
                        onOpenChange={(open) => {
                            setIsAddGroupOpen(open);
                            if (!open) {
                                setTimeout(() => {
                                    setCreationStep('type');
                                    setNewGroupName('');
                                    setSelectedType(null);
                                    setDateRange(undefined);
                                }, 300);
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors border border-primary/20">
                                <Plus className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                            <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                                <DialogHeader className="text-left px-0 w-full">
                                    <DialogTitle className="truncate">
                                        {creationStep === 'type' ? 'Select Group Type' : 'Group Details'}
                                    </DialogTitle>
                                    <DialogDescription className="truncate">
                                        {creationStep === 'type' ? 'What kind of group are you creating?' : 'Add a name and details.'}
                                    </DialogDescription>
                                </DialogHeader>

                                {creationStep === 'type' ? (
                                    <div className="grid grid-cols-2 gap-3 py-4">
                                        {[
                                            { id: 'home', label: 'Home', icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                            { id: 'trip', label: 'Trip', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
                                            { id: 'couple', label: 'Couple', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
                                            { id: 'other', label: 'General', icon: FileText, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    setSelectedType(type.id as any);
                                                    setCreationStep('details');
                                                }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all hover:scale-105 active:scale-95",
                                                    type.bg
                                                )}
                                            >
                                                <type.icon className={cn("w-8 h-8", type.color)} />
                                                <span className="text-xs font-bold">{type.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Name</label>
                                            <Input
                                                placeholder={selectedType === 'trip' ? "e.g. Goa Trip 2024" : "e.g. Apartment, Utilities"}
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                className="bg-secondary/20 border-white/5 h-12 rounded-2xl"
                                            />
                                        </div>

                                        {selectedType === 'trip' && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Dates</label>
                                                <DateRangePicker
                                                    date={dateRange}
                                                    setDate={setDateRange}
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="ghost"
                                                onClick={() => setCreationStep('type')}
                                                className="flex-1 h-12 rounded-xl"
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                onClick={handleCreateGroup}
                                                className="flex-[2] h-12 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold"
                                            >
                                                Create {selectedType === 'trip' ? 'Trip' : 'Group'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
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
                <TabsList className="w-full grid grid-cols-4 bg-secondary/20 p-1 rounded-2xl h-12">
                    <TabsTrigger value="groups" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold">Groups</TabsTrigger>
                    <TabsTrigger value="personal" className="rounded-xl data-[state=active]:bg-card data-[state=amber-500]:text-amber-500 transition-all font-semibold data-[state=active]:text-amber-500">Personal</TabsTrigger>
                    <TabsTrigger value="friends" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold">Friends</TabsTrigger>
                    <TabsTrigger value="settlements" className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary transition-all font-semibold">Settlements</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="mt-6 space-y-6">
                    {/* Active Buckets */}
                    <div className="space-y-4">
                        {buckets.filter(b => !b.is_archived).length > 0 ? (
                            buckets.filter(b => !b.is_archived).map((bucket) => {
                                const spent = bucketSpending[bucket.id] || 0;
                                const budget = Number(bucket.budget);
                                const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                                const remaining = budget - spent;

                                return (
                                    <Card key={bucket.id} className="rounded-3xl overflow-hidden hover:bg-card/60 transition-colors border-white/5 bg-card/40">
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-amber-500/10 border-amber-500/20 text-amber-500">
                                                        {getBucketIcon(bucket.icon)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-base">{bucket.name}</h4>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                            {bucket.start_date && bucket.end_date ? (
                                                                `${format(new Date(bucket.start_date), 'MMM d')} - ${format(new Date(bucket.end_date), 'MMM d, yy')}`
                                                            ) : 'Active Bucket'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingBucket(bucket);
                                                            setNewBucketName(bucket.name);
                                                            setNewBucketTarget(bucket.budget.toString());
                                                            setNewBucketIcon(bucket.icon || 'Tag');
                                                            setBucketDateRange({
                                                                from: bucket.start_date ? new Date(bucket.start_date) : undefined,
                                                                to: bucket.end_date ? new Date(bucket.end_date) : undefined
                                                            });
                                                            setIsEditBucketOpen(true);
                                                        }}
                                                        className="p-2 rounded-full hover:bg-secondary/30 transition-colors"
                                                        title="Edit Bucket"
                                                    >
                                                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => archiveBucket(bucket.id, true)}
                                                        className="p-2 rounded-full hover:bg-secondary/30 transition-colors"
                                                        title="Archive Bucket"
                                                    >
                                                        <Archive className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            toast(`Delete ${bucket.name}?`, {
                                                                description: "Transactions will stay, but the label will be removed.",
                                                                action: {
                                                                    label: 'Delete',
                                                                    onClick: () => deleteBucket(bucket.id)
                                                                }
                                                            })
                                                        }}
                                                        className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                                        title="Delete Bucket"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {budget > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                                                        <div className="flex flex-col">
                                                            <span className="text-muted-foreground">Spent: {formatCurrency(spent)} / {formatCurrency(budget)}</span>
                                                            {bucket.start_date && bucket.end_date && (
                                                                <span className="text-primary/60 lowercase italic font-normal">
                                                                    ~{formatCurrency(budget / Math.max(1, differenceInDays(new Date(bucket.end_date), new Date(bucket.start_date)) / 30))} / mo
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={cn("flex flex-col items-end", remaining < 0 ? "text-rose-500" : "text-amber-500")}>
                                                            <span>{remaining < 0 ? "Over budget by " : "Remaining: "}</span>
                                                            <span>{formatCurrency(Math.abs(remaining))}</span>
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full transition-all duration-500",
                                                                progress >= 100 ? "bg-rose-500" : progress >= 80 ? "bg-orange-500" : "bg-amber-500"
                                                            )}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ) : buckets.filter(b => b.is_archived).length === 0 && (
                            <div className="text-center py-12 space-y-3 bg-secondary/5 rounded-3xl border border-dashed border-white/5">
                                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                                    <Tag className="w-8 h-8 text-amber-500/30" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">No active buckets</p>
                                    <p className="text-[10px] text-muted-foreground px-8">Create a bucket to track private spending like a "Goa Trip" or "Wedding Gift".</p>
                                </div>
                                <Button
                                    onClick={() => setIsAddBucketOpen(true)}
                                    size="sm"
                                    className="rounded-xl h-9 bg-amber-500 hover:bg-amber-600 text-white gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create First Bucket
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Archived Buckets Section */}
                    {buckets.filter(b => b.is_archived).length > 0 && (
                        <div className="pt-4 space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Archive className="w-3 h-3 text-muted-foreground/40" />
                                <h3 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Archived Buckets</h3>
                            </div>
                            {buckets.filter(b => b.is_archived).map((bucket) => (
                                <Card key={bucket.id} className="rounded-3xl overflow-hidden grayscale-[0.5] opacity-60 hover:opacity-100 transition-all border-white/5 bg-card/20 group">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-secondary/10 border-white/5 text-muted-foreground">
                                                {getBucketIcon(bucket.icon)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-muted-foreground">{bucket.name}</h4>
                                                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-bold">Archived</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => archiveBucket(bucket.id, false)}
                                                className="p-2 rounded-full hover:bg-primary/20 hover:text-primary transition-colors"
                                                title="Unarchive Bucket"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    toast(`Delete ${bucket.name}?`, {
                                                        description: "Transactions will stay, but the label will be removed.",
                                                        action: {
                                                            label: 'Delete',
                                                            onClick: () => deleteBucket(bucket.id)
                                                        }
                                                    })
                                                }}
                                                className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                                title="Delete Bucket"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="groups" className="mt-6 space-y-4">
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
                                        onClick={() => setIsAddGroupOpen(true)}
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
                                                        <p className="text-[10px] text-muted-foreground">
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
                        <Card className="bg-card/40 border-primary/20 overflow-hidden relative mx-4">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <UserPlus className="w-24 h-24" />
                            </div>
                            <CardContent className="p-5 relative z-10 text-center">
                                <h3 className="font-bold text-lg mb-1">No friends yet</h3>
                                <p className="text-xs text-muted-foreground mb-4">Add friends by email to start splitting bills.</p>
                                <button
                                    onClick={() => setIsAddFriendOpen(true)}
                                    className="w-full bg-secondary/20 text-foreground text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 border border-white/5"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Add Friend
                                </button>
                            </CardContent>
                        </Card>
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
                                            "w-10 h-10 rounded-full flex items-center justify-center border shrink-0",
                                            isDebtor ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                                        )}>
                                            {isDebtor ? <ArrowUpRight className="w-5 h-5 text-rose-500" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{split.transaction?.description}</p>
                                            <p className="text-[10px] text-muted-foreground italic truncate">
                                                {isDebtor ? `You owe ${split.transaction?.payer_name}` : `${split.transaction?.payer_name} owes you`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                        <span className={cn(
                                            "font-bold text-sm whitespace-nowrap",
                                            isDebtor ? "text-rose-500" : "text-emerald-500"
                                        )}>
                                            {isDebtor ? '-' : '+'}
                                            {// Use transaction currency if available, else user's currency prefix/suffix might be wrong if we just use formatCurrency with number
                                                // formatCurrency uses user's currency preference by default. 
                                                // We want to show: "10 USD" (Original) if different from user currency.
                                                // And "≈ €9.00" (Converted)

                                                // If tx currency is known and different:
                                                split.transaction?.currency && split.transaction.currency !== currency
                                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: split.transaction.currency }).format(split.amount)
                                                    : formatCurrency(split.amount)
                                            }
                                        </span>
                                        {split.transaction?.currency && split.transaction.currency !== currency && (
                                            <span className="text-[10px] text-muted-foreground">
                                                ≈ {formatCurrency(convertAmount(split.amount, split.transaction.currency))}
                                            </span>
                                        )}
                                        {isDebtor && (
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
                                        )}
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
            </Tabs >
        </div >
    );
}
