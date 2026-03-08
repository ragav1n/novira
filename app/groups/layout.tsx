import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Groups & Friends',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
