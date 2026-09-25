'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Map, Bell, Settings, CloudLightning, MapPin, WifiOff, X, UserCircle2 } from 'lucide-react';
import { t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';
import { PulseDot } from './ui';

const LINKS = [
  { href: '/dashboard', key: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/heatmap', key: 'nav_heatmap', icon: Map },
  { href: '/alerts', key: 'nav_alerts', icon: Bell },
  { href: '/settings', key: 'nav_settings', icon: Settings },
];

export function NavBar() {
  const { language, location, user, setAccountOpen, isOffline } = useWGPT();
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <CloudLightning size={20} className="text-brand-to" />
          {t(language, 'app_name')}
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map(({ href, key, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                pathname === href ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {t(language, key)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <Link href="/settings" className="hidden sm:flex items-center gap-1 max-w-[160px] hover:text-white" title={t(language, 'location')}>
            <MapPin size={13} className="text-brand-to shrink-0" />
            <span className="truncate">{location.displayPrimary || location.city}</span>
          </Link>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex items-center gap-1.5 hover:text-white"
            title={t(language, 'account')}
          >
            {user?.profileImage
              ? <img src={user.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" />
              : <UserCircle2 size={20} />}
            <span className="hidden md:inline">{user?.name?.split(' ')[0] || t(language, 'log_in')}</span>
          </button>
          <span className="flex items-center gap-2">
            {isOffline ? <WifiOff size={13} className="text-risk-moderate" /> : <PulseDot />}
            {t(language, 'live')}
          </span>
        </div>
      </div>
    </nav>
  );
}

const BANNER_TONE = {
  red: 'border-risk-severe/50 bg-risk-severe/20 text-red-100',
  orange: 'border-risk-high/50 bg-risk-high/20 text-orange-100',
  yellow: 'border-risk-moderate/50 bg-risk-moderate/15 text-amber-100',
  blue: 'border-brand-from/40 bg-brand-from/15 text-blue-100',
};

export function EmergencyBanner() {
  const { activeAlert, language } = useWGPT();
  const [dismissedText, setDismissedText] = useState(null);
  if (!activeAlert || activeAlert.level === 'green' || dismissedText === activeAlert.text) return null;
  const tone = BANNER_TONE[activeAlert.level] || BANNER_TONE.blue;

  return (
    <div className="max-w-7xl mx-auto px-6 pt-4">
      <div className={`glass rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${tone}`}>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{activeAlert.text}</div>
          {activeAlert.safeZone && (
            <div className="mt-1 text-xs opacity-90"><span className="font-semibold">{t(language, 'safe_zone')}:</span> {activeAlert.safeZone}</div>
          )}
        </div>
        <button type="button" onClick={() => setDismissedText(activeAlert.text)} aria-label={t(language, 'dismiss')} className="opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const { isOffline, offlineSyncTime, language } = useWGPT();
  if (!isOffline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-risk-moderate/90 text-slate-950 text-sm font-medium text-center py-2 px-4">
      {t(language, 'offline_mode')} {offlineSyncTime || '—'}
    </div>
  );
}

export function ToastView() {
  const { toast } = useWGPT();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2100] glass-raised rounded-full px-5 py-2.5 text-sm text-gray-100 shadow-glow"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
