'use client';

import { t } from '@/i18n';
import { useWGPT } from '@/components/wgpt/WeatherGPTProvider';
import { Card } from '@/components/wgpt/ui';
import { LanguageSelector, LocationPicker, RoleSelector } from '@/components/wgpt/Selectors';
import { AccountCard, NotificationsCard, SystemStatusCard } from '@/components/wgpt/AlertCenter';

export default function SettingsPage() {
  const { language } = useWGPT();
  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
      <Card title={t(language, 'settings')}>
        <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{t(language, 'select_language')}</label>
        <LanguageSelector />
        <label className="text-xs text-gray-500 uppercase tracking-wide mt-5 mb-2 block">{t(language, 'select_role')}</label>
        <RoleSelector />
      </Card>
      <Card title={t(language, 'location')} className="relative z-30">
        <LocationPicker />
      </Card>
      <AccountCard />
      <NotificationsCard />
      <SystemStatusCard />
    </div>
  );
}
