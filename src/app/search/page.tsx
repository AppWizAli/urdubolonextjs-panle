'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/ui';

export default function SearchPage() { return <Suspense fallback={<LoadingState />}><SearchContent /></Suspense>; }

function SearchContent() { const params = useSearchParams(); const q = params.get('q') ?? ''; const query = useQuery({ queryKey: ['search', q], queryFn: async () => (await api.get('/search', { params: { q, limit: 20 } })).data, enabled: Boolean(q) }); if (!q) return <div><PageHeader title="Search" description="Search dramas, seasons, episodes, and users from the NestJS catalog." /><div className="surface flex min-h-[240px] items-center justify-center text-sm text-slate-500"><Search size={18} className="mr-2" /> Enter a term in the workspace search.</div></div>; if (query.isLoading) return <LoadingState />; if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={() => query.refetch()} />; const data = query.data ?? {}; return <div><PageHeader eyebrow="Workspace search" title={`Results for "${q}"`} /><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[['Dramas', data.dramas], ['Seasons', data.seasons], ['Episodes', data.episodes], ['Users', data.users]].map(([label, rows]) => <section className="surface" key={String(label)}><div className="border-b border-line p-4"><div className="eyebrow">{label}</div></div><div className="divide-y divide-line">{(rows as any[] ?? []).map((row) => <div className="p-4" key={row.id}><div className="font-semibold">{row.name ?? row.title ?? row.username}</div><div className="mt-1 text-xs text-slate-500">{row.email ?? row.slug ?? row.id}</div>{row.status && <div className="mt-2"><StatusBadge value={row.status} /></div>}</div>)}</div></section>)}</div></div>; }
