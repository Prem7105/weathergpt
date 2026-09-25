'use client';

import { AlertCenter, NotificationsCard } from '@/components/wgpt/AlertCenter';

export default function AlertsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <AlertCenter />
      <NotificationsCard />
    </div>
  );
}
