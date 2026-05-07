import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create a free Novira account — track expenses, split bills with friends, and manage your money across 20+ currencies. No credit card, no bank linking.',
  alternates: { canonical: '/signup' },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
