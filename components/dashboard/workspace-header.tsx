'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, HelpCircle, Plus, UserCircle, Heart, Home, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FluidDropdown, Category } from '@/components/ui/fluid-dropdown';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Group } from '@/components/providers/groups-provider';

interface WorkspaceHeaderProps {
    userName: string;
    avatarUrl: string | null;
    eligibleGroups: Group[];
    activeWorkspaceId: string | null;
    setActiveWorkspaceId: (id: string | null) => void;
    setDashboardFocus: (focus: string) => void;
    setIsHowToUseOpen: (open: boolean) => void;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
}

export function WorkspaceHeader({
    userName,
    avatarUrl,
    eligibleGroups,
    activeWorkspaceId,
    setActiveWorkspaceId,
    setDashboardFocus,
    setIsHowToUseOpen,
    isCoupleWorkspace,
    isHomeWorkspace
}: WorkspaceHeaderProps) {
    const router = useRouter();
    const { privacyMode, isPrivacyHidden, togglePrivacyHidden } = useUserPreferences();

    return (
        <div className="flex justify-between items-center pt-2 gap-2 relative z-[70]">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 relative shrink-0">
                    <Image src="/Novira.png" alt="Novira" width={40} height={40} priority className="object-contain drop-shadow-[0_0_8px_rgba(138,43,226,0.5)]" />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                    {eligibleGroups.length > 0 ? (
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 -ml-1">
                            <h1 className="text-xl font-bold flex items-center gap-1.5 min-w-0 shrink-0 ml-1">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 truncate">Hi, {userName.split(' ')[0]}!</span>
                                <span className="shrink-0">👋</span>
                            </h1>
                            <FluidDropdown
                                activeId={activeWorkspaceId || 'personal'}
                                items={[
                                    {
                                        id: "personal",
                                        label: "Personal",
                                        icon: UserCircle,
                                        color: "#8a2be2", // primary
                                    },
                                    ...eligibleGroups.map(g => ({
                                        id: g.id,
                                        label: g.name,
                                        icon: g.type === 'couple' ? Heart : g.type === 'home' ? Home : Users,
                                        color: g.type === 'couple' ? "#f43f5e" : g.type === 'home' ? "#eab308" : "#8a2be2",
                                    }))
                                ]}
                                onSelect={(category: Category) => {
                                    if (category.id === "personal") {
                                        setActiveWorkspaceId(null);
                                    } else {
                                        setActiveWorkspaceId(category.id);
                                    }
                                    setDashboardFocus('allowance');
                                }}
                                triggerClassName="h-auto py-1 px-2.5 bg-transparent border-0 hover:bg-white/5 focus:ring-0 w-auto inline-flex outline-none !text-sm text-muted-foreground hover:text-foreground shrink-0"
                            />
                        </div>
                    ) : (
                        <>
                            <h1 className="text-xl font-bold flex items-center gap-1.5 min-w-0 mb-0.5">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 truncate">Hi, {userName.split(' ')[0]}!</span>
                                <span className="shrink-0">👋</span>
                            </h1>
                            <p className="text-[11px] text-muted-foreground font-medium truncate">
                                Track your expenses with Novira
                            </p>
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={() => router.push('/settings')}
                    aria-label="Open settings"
                    className="w-10 h-10 rounded-full bg-secondary/20 border border-white/5 overflow-hidden flex items-center justify-center text-xs font-bold text-muted-foreground uppercase shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                >
                    {avatarUrl ? (
                        <Image src={avatarUrl} alt="Avatar" width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                        userName.substring(0, 2)
                    )}
                </button>
                {privacyMode && (
                    <button
                        onClick={togglePrivacyHidden}
                        aria-label={isPrivacyHidden ? 'Reveal amounts' : 'Hide amounts'}
                        className="w-10 h-10 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center border border-white/5 transition-colors shrink-0"
                        title={isPrivacyHidden ? 'Reveal amounts' : 'Hide amounts'}
                    >
                        {isPrivacyHidden ? <Eye className="w-5 h-5 text-white/70" /> : <EyeOff className="w-5 h-5 text-white/70" />}
                    </button>
                )}
                <button
                    onClick={() => setIsHowToUseOpen(true)}
                    className="w-10 h-10 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center border border-white/5 transition-colors shrink-0"
                    title="How to use Novira"
                >
                    <HelpCircle className="w-5 h-5 text-white/70" />
                </button>
                <button
                    onClick={() => router.push('/add')}
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0",
                        isCoupleWorkspace ? "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/20" : isHomeWorkspace ? "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/20" : "bg-primary/20 hover:bg-primary/30 border-primary/20"
                    )}
                    title="Add Expense"
                >
                    <Plus className={cn("w-5 h-5", isCoupleWorkspace ? "text-rose-500" : isHomeWorkspace ? "text-yellow-500" : "text-primary")} />
                </button>
            </div>
        </div>
    );
}
