import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { MobileLayout } from '@/components/mobile-layout'
import { PWAUpdater } from '@/components/pwa-updater'
import { UserPreferencesProvider } from '@/components/providers/user-preferences-provider'
import { GroupsProvider } from '@/components/providers/groups-provider'
import { BucketsProvider } from '@/components/providers/buckets-provider'

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: 'Novira - Finance Tracker',
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
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') || '';

  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <PWAUpdater />
        <UserPreferencesProvider>
          <MobileLayout>
            <GroupsProvider>
              <BucketsProvider>
                {children}
              </BucketsProvider>
            </GroupsProvider>
          </MobileLayout>
        </UserPreferencesProvider>
        <Analytics />
        <script
          nonce={nonce}
          suppressHydrationWarning={true}
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
