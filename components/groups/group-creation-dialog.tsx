import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Home, Plane, Heart, FileText, Users, ArrowLeft } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useGroupsActions } from '@/components/providers/groups-provider';
import { toast } from '@/utils/haptics';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';

interface GroupCreationDialogProps {
    /** When provided, the dialog is fully controlled and the default trigger button is hidden. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type GroupTypeId = 'home' | 'trip' | 'couple' | 'other';

const TYPE_OPTIONS: { id: GroupTypeId; label: string; description: string; icon: React.ElementType; tint: string; bg: string; ring: string }[] = [
    { id: 'home', label: 'Home', description: 'Rent, utilities, groceries', icon: Home, tint: 'text-emerald-400', bg: 'bg-emerald-400/[0.06]', ring: 'ring-emerald-400/20' },
    { id: 'trip', label: 'Trip', description: 'A fixed-window adventure', icon: Plane, tint: 'text-sky-400', bg: 'bg-sky-400/[0.06]', ring: 'ring-sky-400/20' },
    { id: 'couple', label: 'Couple', description: 'Two-person shared expenses', icon: Heart, tint: 'text-rose-400', bg: 'bg-rose-400/[0.06]', ring: 'ring-rose-400/20' },
    { id: 'other', label: 'General', description: 'Custom or one-off shared cost', icon: FileText, tint: 'text-primary', bg: 'bg-primary/[0.06]', ring: 'ring-primary/20' },
];

export function GroupCreationDialog({ open, onOpenChange }: GroupCreationDialogProps = {}) {
    const { createGroup } = useGroupsActions();
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = isControlled ? open! : internalOpen;
    const setIsOpen = (next: boolean) => {
        if (isControlled) onOpenChange?.(next);
        else setInternalOpen(next);
    };
    const [creationStep, setCreationStep] = useState<'type' | 'details'>('type');
    const [selectedType, setSelectedType] = useState<GroupTypeId | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const selectedMeta = TYPE_OPTIONS.find(t => t.id === selectedType);

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
            toast.success('Group created');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create group'));
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
            {!isControlled && (
                <DialogTrigger asChild>
                    <button className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Plus className="w-[18px] h-[18px]" />
                    </button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-[400px] w-[95vw] rounded-[28px] border-white/[0.08] bg-card/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
                <div className="p-5 space-y-4">
                    <DialogHeader className="text-left flex-row items-start gap-3 space-y-0">
                        <div
                            className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                                creationStep === 'details' && selectedMeta ? selectedMeta.bg : 'bg-primary/[0.06]',
                            )}
                        >
                            {creationStep === 'details' && selectedMeta ? (
                                <selectedMeta.icon className={cn('w-[18px] h-[18px]', selectedMeta.tint)} />
                            ) : (
                                <Users className="w-[18px] h-[18px] text-primary" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-[15px] font-semibold tracking-tight truncate">
                                {creationStep === 'type' ? 'New group' : `New ${selectedMeta?.label.toLowerCase() || 'group'}`}
                            </DialogTitle>
                            <DialogDescription className="text-[12px] mt-0.5 truncate">
                                {creationStep === 'type'
                                    ? 'Pick a kind so we can tune the defaults.'
                                    : 'Give it a name — you can edit details later.'}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {creationStep === 'type' ? (
                        <ul className="space-y-1.5">
                            {TYPE_OPTIONS.map((type) => (
                                <li key={type.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedType(type.id);
                                            setCreationStep('details');
                                        }}
                                        className={cn(
                                            'group w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.16] transition-colors text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                                        )}
                                    >
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', type.bg)}>
                                            <type.icon className={cn('w-[18px] h-[18px]', type.tint)} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold">{type.label}</p>
                                            <p className="text-[11px] text-muted-foreground">{type.description}</p>
                                        </div>
                                        <span className={cn('text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity', type.tint)}>
                                            Choose →
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="group-name" className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                    Name
                                </label>
                                <Input
                                    id="group-name"
                                    name="group-name"
                                    autoFocus
                                    placeholder={selectedType === 'trip' ? 'e.g. Lisbon May' : 'e.g. Apartment, Utilities'}
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl"
                                />
                            </div>

                            {selectedType === 'trip' && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                        Dates
                                    </p>
                                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                                </div>
                            )}

                            <div className="flex gap-2 pt-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCreationStep('type')}
                                    className="h-11 rounded-xl text-muted-foreground hover:text-foreground"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                                    Back
                                </Button>
                                <Button
                                    onClick={handleCreateGroup}
                                    className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold"
                                >
                                    Create {selectedType === 'trip' ? 'trip' : 'group'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
