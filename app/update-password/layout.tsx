import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Update password',
  description: 'Choose a new password for your Novira account.',
  alternates: { canonical: '/update-password' },
}

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
