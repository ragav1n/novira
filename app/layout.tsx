import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { MobileLayout } from '@/components/mobile-layout'
import { UserPreferencesProvider } from '@/components/providers/user-preferences-provider'
import { GroupsProvider } from '@/components/providers/groups-provider'
import { BucketsProvider } from '@/components/providers/buckets-provider'
import { SyncIndicator } from '@/components/pwa-sync-indicator'
import { WorkspaceThemeProvider } from '@/components/providers/workspace-theme-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar'

const geist = Inter({
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
    default: 'Novira - Finance Tracker',
  },
  description: 'Experience the future of personal finance with Novira. Track spending, manage budgets, and visualize your financial universe.',
  generator: 'v0.app',
  icons: {
    icon: '/Novira.png',
    shortcut: '/Novira.png',
    apple: '/Novira.png',
  },
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Novira - Finance Tracker',
    description: 'Track spending, manage budgets, split expenses, and visualize your financial universe.',
    type: 'website',
    images: [{ url: '/Novira.png', width: 512, height: 512, alt: 'Novira Logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Novira - Finance Tracker',
    description: 'Track spending, manage budgets, split expenses, and visualize your financial universe.',
    images: ['/Novira.png'],
  },
}

export const viewport = {
  themeColor: '#0c081e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="preconnect" href="https://vitals.vercel-analytics.com" />
        <link rel="dns-prefetch" href="https://cdn.vercel-analytics.com" />
      </head>
      <body suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <UserPreferencesProvider>
            <GroupsProvider>
              <WorkspaceThemeProvider />
              <SyncIndicator />
              <BucketsProvider>
                <MobileLayout>
                  {children}
                </MobileLayout>
              </BucketsProvider>
            </GroupsProvider>
          </UserPreferencesProvider>
        </ErrorBoundary>
        <ServiceWorkerRegistrar />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
