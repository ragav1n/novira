'use client'

import { GroupsView } from '@/components/groups-view'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Session } from '@supabase/supabase-js'
import { useUserPreferences } from '@/components/providers/user-preferences-provider'

export default function GroupsPage() {
    const router = useRouter()
    const { isAuthenticated, isLoading } = useUserPreferences()

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin')
        }
    }, [isLoading, isAuthenticated, router])

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (!isAuthenticated) return null

    return <GroupsView />
}
