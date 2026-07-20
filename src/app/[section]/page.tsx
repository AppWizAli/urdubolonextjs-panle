'use client';

import { useParams } from 'next/navigation';
import { SectionPage } from '@/components/section-page';

export default function SectionRoute() {
  const params = useParams<{ section: string }>();
  return <SectionPage section={params.section} />;
}
