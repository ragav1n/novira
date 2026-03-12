'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteAccount } from '@/app/actions/delete-account'
import { toast } from '@/utils/haptics'
import { WaveLoader } from '@/components/ui/wave-loader'

export default function ConfirmDeletePage() {
    const router = useRouter()
    const [status, setStatus] = useState('Verifying identity...')

    useEffect(() => {
        let isCancelled = false

        async function handleDeletionFlow() {
            try {
                // 1. Manually check for 'code' in URL and exchange it
                const params = new URLSearchParams(window.location.search)
                const code = params.get('code')

                if (code) {
                    setStatus('Exchanging code for session...')
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                    if (exchangeError) throw exchangeError
                }

                if (isCancelled) return

                // 2. Get and verify user session
                setStatus('Verifying session...')
                const { data: { user }, error: userError } = await supabase.auth.getUser()

                if (userError || !user) {
                    throw new Error('Verification failed. Not authenticated.')
                }

                if (!user.email) {
                    throw new Error('Verification failed. User email not found.')
                }

                if (isCancelled) return

                // 3. Initiate deletion
                setStatus('Deleting account...')
                const result = await deleteAccount(user.email)

                if (result.error) {
                    throw new Error(result.error)
                }

                if (isCancelled) return

                // 4. Finalize
                setStatus('Cleaning up...')
                await supabase.auth.signOut()
                
                router.push('/signin?message=Account+deleted')

            } catch (error: any) {
                console.error('Deletion flow error:', error)
                if (!isCancelled) {
                    setStatus(`Error: ${error.message || 'Failed to delete account'}`)
                    toast.error(error.message || 'Failed to delete account')
                    // Delay redirect so user can see the error
                    setTimeout(() => {
                        if (!isCancelled) router.push('/settings')
                    }, 4000)
                }
            }
        }

        handleDeletionFlow()

        return () => {
            isCancelled = true
        }
    }, [router])

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full space-y-8">
                <div className="space-y-4">
                    <WaveLoader bars={5} message={status} />
                    <p className="text-muted-foreground text-sm">
                        Please wait while we securely process your request.
                    </p>
                </div>
            </div>
        </div>
    )
}