import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Reset your Novira account password.',
  alternates: { canonical: '/forgot-password' },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
