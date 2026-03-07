import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Home, Plane, Heart, FileText } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useGroups } from '@/components/providers/groups-provider';
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';

export function GroupCreationDialog() {
    const { createGroup } = useGroups();
    const [isOpen, setIsOpen] = useState(false);
    const [creationStep, setCreationStep] = useState<'type' | 'details'>('type');
    const [selectedType, setSelectedType] = useState<'home' | 'trip' | 'couple' | 'other' | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

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
            setIsOpen(false);
            toast.success('Group created successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create group');
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
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
                                    placeholder={selectedType === 'trip' ? "e.g. Trip" : "e.g. Apartment, Utilities"}
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
    );
}
