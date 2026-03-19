import { useState, useEffect, useRef } from 'react';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';

export function useDashboardState(userId: string | null) {
    // Dashboard Focus State
    const [dashboardFocus, setDashboardFocus] = useState<string>('');
    const [isFocusRestored, setIsFocusRestored] = useState(false);
    const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
    const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);

    // Modal Sequencing State
    const [activeModal, setActiveModal] = useState<'welcome' | 'announcement' | null>(null);
    const [isFocusMenuOpen, setIsFocusMenuOpen] = useState(false);
    const focusSelectorRef = useRef<HTMLDivElement>(null);
    const [hoveredFocusId, setHoveredFocusId] = useState<string | null>(null);

    // Modal Interaction State
    const [isViewAllOpen, setIsViewAllOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);

    // Handle modal sequencing and initial focus load
    useEffect(() => {
        if (userId && !isFocusRestored) {
            // 1. Sync Restoration
            const savedFocus = localStorage.getItem(`dashboard_focus_${userId}`);
            setDashboardFocus(savedFocus || 'allowance');
            setIsFocusRestored(true);

            // Modal Sequencing Logic — runs once per login, guarded by isFocusRestored
            const hasSeenWelcome = localStorage.getItem(`welcome_seen_${userId}`);
            const lastSeenFeatureId = localStorage.getItem(`last_seen_feature_id_${userId}`) || localStorage.getItem('last_seen_feature_id');
            const hasNewAnnouncement = lastSeenFeatureId !== LATEST_FEATURE_ANNOUNCEMENT.id;

            if (!hasSeenWelcome) {
                setTimeout(() => setActiveModal('welcome'), 1500);
            } else if (hasNewAnnouncement) {
                setTimeout(() => setActiveModal('announcement'), 1500);
            }
        }
    }, [userId, isFocusRestored]);

    // Save Focus Mode Persistence
    useEffect(() => {
        if (userId && dashboardFocus && isFocusRestored && dashboardFocus !== '') {
            localStorage.setItem(`dashboard_focus_${userId}`, dashboardFocus);
        }
    }, [userId, dashboardFocus, isFocusRestored]);

    // Global click outside for focus selector dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (focusSelectorRef.current && !focusSelectorRef.current.contains(event.target as Node)) {
                setIsFocusMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return {
        dashboardFocus,
        setDashboardFocus,
        isFocusRestored,
        isAddFundsOpen,
        setIsAddFundsOpen,
        isHowToUseOpen,
        setIsHowToUseOpen,
        activeModal,
        setActiveModal,
        isFocusMenuOpen,
        setIsFocusMenuOpen,
        focusSelectorRef,
        hoveredFocusId,
        setHoveredFocusId,
        isViewAllOpen,
        setIsViewAllOpen,
        isMapOpen,
        setIsMapOpen
    };
}
