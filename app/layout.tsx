import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { MobileLayout } from '@/components/mobile-layout'
import { UserPreferencesProvider } from '@/components/providers/user-preferences-provider'
import { GroupsProvider } from '@/components/providers/groups-provider'

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
}

export const viewport = {
  themeColor: '#0c081e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

import { headers } from 'next/headers'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <UserPreferencesProvider>
          <MobileLayout>
            <GroupsProvider>
              {children}
            </GroupsProvider>
          </MobileLayout>
        </UserPreferencesProvider>
        <Analytics />
      </body>
    </html>
  )
}
