import {
  BarChart3, Bell, Boxes, Clapperboard, FileCheck2, FileText, Gauge, KeyRound, LayoutDashboard, MessageSquare, MonitorCog, Newspaper, PackageCheck, PanelsTopLeft, PlaySquare, ReceiptText, ScrollText, Settings2, ShieldCheck, Sparkles, Tv, Users, UsersRound,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: typeof Gauge; permission?: string; children?: { href: string; label: string; permission?: string }[] };

export const navigation: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users, permission: 'users.read' },
  { href: '/admins', label: 'Admins & Roles', icon: KeyRound, permission: 'users.read' },
  { href: '/content', label: 'Content', icon: Clapperboard, permission: 'content.read', children: [{ href: '/content', label: 'Drama, seasons & episodes' }, { href: '/media-assets', label: 'Media assets', permission: 'media.read' }, { href: '/media-validation', label: 'Media validation', permission: 'media.read' }, { href: '/uploads', label: 'Uploads', permission: 'media.write' }, { href: '/trending', label: 'Trending', permission: 'trending.read' }] },
  { href: '/groups', label: 'Groups & Access', icon: UsersRound, permission: 'access.read' },
  { href: '/subscriptions', label: 'Subscriptions', icon: ReceiptText, permission: 'subscriptions.read' },
  { href: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.read' },
  { href: '/firebase', label: 'Firebase delivery', icon: MonitorCog, permission: 'notifications.read' },
  { href: '/messages', label: 'Messages', icon: MessageSquare, permission: 'user.self' },
  { href: '/banners', label: 'Banners', icon: PanelsTopLeft, permission: 'banners.read' },
  { href: '/analytics', label: 'Analytics & Reports', icon: BarChart3, permission: 'analytics.read' },
  { href: '/comments', label: 'Comments', icon: Newspaper, permission: 'content.read' },
  { href: '/security', label: 'Security incidents', icon: ShieldCheck, permission: 'security.read' },
  { href: '/releases', label: 'APK & Versions', icon: PackageCheck, permission: 'app.release.read' },
  { href: '/widevine', label: 'Widevine / DRM', icon: Tv, permission: 'media.read' },
  { href: '/utilities', label: 'Legacy utilities', icon: FileText, permission: 'users.read' },
  { href: '/settings', label: 'Settings', icon: Settings2, permission: 'settings.read' },
  { href: '/audit', label: 'Audit logs', icon: ScrollText, permission: 'audit.read' },
];

export const quickLinks = [
  { href: '/content', label: 'Manage content', icon: PlaySquare },
  { href: '/subscriptions', label: 'Review payments', icon: FileCheck2 },
  { href: '/releases', label: 'Publish APK', icon: PackageCheck },
  { href: '/settings', label: 'Remote config', icon: MonitorCog },
  { href: '/groups', label: 'Access groups', icon: Boxes },
  { href: '/analytics', label: 'Open reports', icon: FileText },
  { href: '/notifications', label: 'Send notification', icon: Sparkles },
  { href: '/users', label: 'User directory', icon: Tv },
];
