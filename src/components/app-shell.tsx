'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, getCurrentUser } from '@/lib/api';
import { navigation, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type SessionUser = { id: string; username: string; email: string; status: string; roles?: { role: { code: string; name: string; permissions?: { permission: { code: string } }[] } }[]; permissions?: { permission: { code: string } }[] };

function hasPermission(user: SessionUser | null, permission?: string) {
  if (!permission) return true;
  return Boolean(user?.roles?.some(({ role }) => ['SUPER_ADMIN', 'ADMIN'].includes(role.code) || role.permissions?.some(({ permission: item }) => item.code === permission)) || user?.permissions?.some(({ permission: item }) => item.code === permission)) || permission === 'user.self';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('urdubolo_user');
    return stored ? JSON.parse(stored) as SessionUser : null;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) return;
    getCurrentUser().then((value) => {
      setUser(value);
      window.localStorage.setItem('urdubolo_user', JSON.stringify(value));
    }).catch(() => router.push('/login'));
  }, [router, user]);

  const visibleNav = useMemo(() => navigation.filter((item) => hasPermission(user, item.permission)), [user]);
  const activeLabel = visibleNav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? 'Dashboard';

  function logout() {
    const refreshToken = window.localStorage.getItem('urdubolo_refresh_token');
    if (refreshToken) void api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    window.localStorage.removeItem('urdubolo_access_token');
    window.localStorage.removeItem('urdubolo_refresh_token');
    window.localStorage.removeItem('urdubolo_user');
    router.push('/login');
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="min-h-screen bg-canvas">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-slate-800 bg-ink text-white transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed && 'lg:w-[84px]')}>
        <div className="flex h-[76px] items-center border-b border-white/10 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand text-lg font-black">UB</div>
          {!collapsed && <div className="ml-3 min-w-0"><div className="truncate text-sm font-bold">Urdu Bolo</div><div className="text-[11px] text-slate-400">Operations console</div></div>}
          <button className="ml-auto hidden text-slate-400 hover:text-white lg:block" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
          <button className="ml-auto text-slate-400 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className={cn('mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500', collapsed && 'text-center')}>{collapsed ? '*' : 'Workspace'}</div>
          <div className="space-y-1">
            {visibleNav.map((item) => <NavLink key={item.href} item={item} active={pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))} collapsed={collapsed} onClick={() => setMobileOpen(false)} />)}
          </div>
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className={cn('flex items-center gap-3 bg-white/5 p-3', collapsed && 'justify-center p-2')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-teal text-xs font-black">{user?.username?.slice(0, 2).toUpperCase() ?? 'AD'}</div>
            {!collapsed && <div className="min-w-0"><div className="truncate text-xs font-semibold">{user?.username ?? 'Loading account'}</div><div className="truncate text-[11px] text-slate-400">{user?.roles?.[0]?.role.name ?? 'Administrator'}</div></div>}
          </div>
        </div>
      </aside>
      <div className={cn('min-h-screen transition-[padding] lg:pl-[270px]', collapsed && 'lg:pl-[84px]')}>
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3"><button className="btn-quiet h-9 w-9 p-0 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div><div className="eyebrow hidden sm:block">Urdu Bolo / {activeLabel}</div><h1 className="truncate text-lg font-bold text-ink sm:text-xl">{activeLabel}</h1></div></div>
          <div className="flex items-center gap-2 md:gap-4"><form onSubmit={submitSearch} className="relative hidden w-52 md:block lg:w-72"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspace" aria-label="Search workspace" /></form><Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center border border-line text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell size={17} /></Link><button onClick={logout} className="btn-secondary hidden h-9 px-3 sm:inline-flex" title="Sign out"><LogOut size={15} /><span>Sign out</span></button></div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <Link href={item.href} onClick={onClick} className={cn('group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white', active && 'bg-brand text-white shadow-lg shadow-brand/20', collapsed && 'justify-center px-2')} title={collapsed ? item.label : undefined}><Icon size={17} className="shrink-0" />{!collapsed && <span className="truncate">{item.label}</span>}</Link>;
}
