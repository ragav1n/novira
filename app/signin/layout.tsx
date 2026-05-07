import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Novira — track expenses, split bills with friends, and manage your money across 20+ currencies. Works offline as a PWA.',
  alternates: { canonical: '/signin' },
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
