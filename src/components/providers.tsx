'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './app-shell';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } }));
  const pathname = usePathname();
  return <QueryClientProvider client={client}>{pathname === '/login' ? children : <AppShell>{children}</AppShell>}</QueryClientProvider>;
}
