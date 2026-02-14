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
  }
}

export const viewport = {
  themeColor: '#0c081e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <MobileLayout>
          <UserPreferencesProvider>
            <GroupsProvider>
              {children}
            </GroupsProvider>
          </UserPreferencesProvider>
        </MobileLayout>
        <Analytics />
      </body>
    </html>
  )
}
