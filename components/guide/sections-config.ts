import {
  Sparkles,
  Home,
  Plus,
  Repeat,
  Users,
  Globe,
  Box,
  Target,
  Wallet,
  CalendarDays,
  BarChart2,
  Search,
  Bell,
  WifiOff,
  Hand,
  Database,
  Settings,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export type GuideSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  group: string;
  blurb: string;
};

export const GUIDE_GROUPS = [
  'Start here',
  'Money in & out',
  'Plan & track',
  'Understand',
  'Together',
  'Platform',
  'Releases',
] as const;

export const GUIDE_SECTIONS: GuideSection[] = [
  { id: 'getting-started', title: 'Getting started', icon: Sparkles, group: 'Start here', blurb: 'Sign up, install the app, and find your way around.' },
  { id: 'dashboard', title: 'The dashboard', icon: Home, group: 'Start here', blurb: 'Your home base — what every panel means.' },

  { id: 'adding-transactions', title: 'Adding transactions', icon: Plus, group: 'Money in & out', blurb: 'Every field, every shortcut, every smart suggestion.' },
  { id: 'recurring', title: 'Recurring & subscriptions', icon: Repeat, group: 'Money in & out', blurb: 'Bills, subscriptions, paychecks. Manual and auto-detected.' },
  { id: 'splits', title: 'Splitting expenses', icon: Users, group: 'Money in & out', blurb: 'Share a tab with friends and settle up cleanly.' },
  { id: 'multi-currency', title: 'Multi-currency & trips', icon: Globe, group: 'Money in & out', blurb: '20 supported currencies, live conversion, and trip-mode buckets.' },

  { id: 'buckets', title: 'Buckets', icon: Box, group: 'Plan & track', blurb: 'Spending containers for trips, projects, and missions.' },
  { id: 'goals', title: 'Savings goals', icon: Target, group: 'Plan & track', blurb: 'Set a target, log deposits, watch the bar fill.' },
  { id: 'allowance', title: 'Monthly allowance', icon: Wallet, group: 'Plan & track', blurb: 'Set a budget, exclude what shouldn’t count, carry the rest forward.' },
  { id: 'cashflow', title: 'Cash flow calendar', icon: CalendarDays, group: 'Plan & track', blurb: 'See your month at a glance — bills, deadlines, tightest day.' },

  { id: 'analytics', title: 'Analytics & insights', icon: BarChart2, group: 'Understand', blurb: 'Charts, trends, AI insights, and the what-if simulator.' },
  { id: 'search', title: 'Search & filters', icon: Search, group: 'Understand', blurb: 'Find any transaction with text, numbers, or tags.' },

  { id: 'groups', title: 'Groups & friends', icon: Users, group: 'Together', blurb: 'Workspaces for couples, households, and trips.' },

  { id: 'notifications', title: 'Notifications', icon: Bell, group: 'Platform', blurb: 'Bill reminders, digests, quiet hours, and how to turn notifications on.' },
  { id: 'offline', title: 'Offline & sync', icon: WifiOff, group: 'Platform', blurb: 'How Novira keeps working without a connection.' },
  { id: 'gestures', title: 'Gestures', icon: Hand, group: 'Platform', blurb: 'Swipe, pull, drag — the shortcuts you can feel.' },
  { id: 'data', title: 'Import & export', icon: Database, group: 'Platform', blurb: 'Bank statements in. Spreadsheets, PDFs, and calendar files out.' },
  { id: 'settings', title: 'Settings reference', icon: Settings, group: 'Platform', blurb: 'Every toggle, organized by section.' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: HelpCircle, group: 'Platform', blurb: 'Stuck on something? Start here.' },

  { id: 'whats-new', title: 'What’s new', icon: Sparkles, group: 'Releases', blurb: 'A running log of what shipped, in plain language.' },
];
