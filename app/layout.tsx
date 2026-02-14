import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { MobileLayout } from '@/components/mobile-layout'
import { UserPreferencesProvider } from '@/components/providers/user-preferences-provider'

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: 'Expense Tracker - Track Your Spending',
  description: 'Take control of your finances with our beautiful and intuitive expense tracking app. Monitor spending, categorize expenses, and visualize your financial habits.',
  generator: 'v0.app',
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
            {children}
          </UserPreferencesProvider>
        </MobileLayout>
        <Analytics />
      </body>
    </html>
  )
}
