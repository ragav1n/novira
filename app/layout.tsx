import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { MotionConfig } from 'framer-motion'
import { MobileLayout } from '@/components/mobile-layout'
import { UserPreferencesProvider } from '@/components/providers/user-preferences-provider'
import { GroupsProvider } from '@/components/providers/groups-provider'
import { BucketsProvider } from '@/components/providers/buckets-provider'
import { AccountsProvider } from '@/components/providers/accounts-provider'
import { SyncIndicator } from '@/components/pwa-sync-indicator'
import { WorkspaceThemeProvider } from '@/components/providers/workspace-theme-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import { NetworkErrorBanner } from '@/components/network-error-banner'
import { AppResetModal } from '@/components/app-reset-modal'
import { MonthlyRecapModal } from '@/components/recap/monthly-recap-modal'

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s - Novira',
    default: 'Novira — Smarter personal finance',
  },
  description: 'Track spending, split with friends, and understand your money — works offline, supports 150+ currencies, with AI receipt scanning and analytics.',
  icons: {
    icon: [
      { url: '/icons/novira-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/novira-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/novira-192.png',
    apple: '/icons/novira-512.png',
  },
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://novira.one'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Novira — Smarter personal finance',
    description: 'Track spending, split with friends, and understand your money — in one quietly brilliant app that works anywhere, even offline.',
    type: 'website',
    url: 'https://novira.one',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Novira — Smarter personal finance',
    description: 'Track spending, split with friends, and understand your money — in one quietly brilliant app that works anywhere, even offline.',
  },
}

export const viewport = {
  themeColor: '#0c081e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const ua = (await headers()).get('user-agent') ?? '';
  const defaultIsDesktop = !/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="preconnect" href="https://vitals.vercel-analytics.com" />
        <link rel="dns-prefetch" href="https://cdn.vercel-analytics.com" />
      </head>
      <body suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-bold focus:text-sm">
          Skip to main content
        </a>
        <ErrorBoundary>
          <MotionConfig reducedMotion="user">
            <UserPreferencesProvider>
              <GroupsProvider>
                <WorkspaceThemeProvider />
                <SyncIndicator />
                <AccountsProvider>
                  <BucketsProvider>
                    <MobileLayout defaultIsDesktop={defaultIsDesktop}>
                      {children}
                    </MobileLayout>
                    <MonthlyRecapModal />
                  </BucketsProvider>
                </AccountsProvider>
              </GroupsProvider>
            </UserPreferencesProvider>
          </MotionConfig>
        </ErrorBoundary>
        <ServiceWorkerRegistrar />
        <PWAInstallPrompt />
        <NetworkErrorBanner />
        <AppResetModal />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
