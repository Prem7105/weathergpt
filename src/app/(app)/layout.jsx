'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWGPT } from '@/components/wgpt/WeatherGPTProvider';
import { NavBar, EmergencyBanner } from '@/components/wgpt/Chrome';

export default function AppLayout({ children }) {
  const { hydrated, onboarded } = useWGPT();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !onboarded) router.replace('/');
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) return null;

  return (
    <>
      <NavBar />
      <EmergencyBanner />
      {children}
    </>
  );
}
