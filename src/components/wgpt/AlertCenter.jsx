'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Send, RefreshCw, Radio, UserCircle2, Activity, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import NotificationSettings from '@/components/Notifications/NotificationSettings';
import { t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';
import { Card, RiskBadge, formatTime } from './ui';

const LEVEL_FROM_BANNER = { red: 'severe', orange: 'high', yellow: 'moderate', green: 'low', blue: 'low' };

export function AlertCenter() {
  const { language, riskData, riskLoading, reloadRisk, activeAlert, weatherAlerts, scenario, selectScenario } = useWGPT();
  const alert = riskData?.alert;
  const incidents = riskData?.incidents?.incidents || [];

  const items = [];
  if (alert) {
    items.push({
      id: alert.eventId || 'risk',
      title: `${t(language, 'active_risk_alert')}: ${String(alert.hazard).replace(/_/g, ' ')} · ${alert.alertLevel || alert.level}`,
      description: [alert.reason, alert.impact].filter(Boolean).join(' — '),
      action: alert.recommendedAction,
      meta: `${alert.source || ''} · ${alert.method || ''} · peak ${formatTime(alert.expectedTime)}`,
      level: alert.severity || alert.level,
      simulated: alert.dataStatus === 'DEMO-SCENARIO',
    });
  }
  if (activeAlert && activeAlert.level !== 'green') {
    items.push({
      id: 'weather-warning',
      title: activeAlert.text,
      description: '',
      action: activeAlert.safeZone,
      meta: t(language, 'weather_warning'),
      level: LEVEL_FROM_BANNER[activeAlert.level] || 'moderate',
    });
  }
  (weatherAlerts || []).forEach((wa, i) => {
    items.push({
      id: `official-${i}`,
      title: wa.headline || wa.event || 'Official weather alert',
      description: wa.description || '',
      action: wa.instruction || '',
      meta: wa.source || 'Official feed',
      level: /extreme|severe/i.test(wa.severity || '') ? 'severe' : /moderate/i.test(wa.severity || '') ? 'high' : 'moderate',
    });
  });
  incidents.forEach((inc) => {
    items.push({
      id: inc._id || inc.sourceId,
      title: `${inc.category} · ${inc.location?.name || ''}`,
      description: inc.source || '',
      action: '',
      meta: inc.verification?.status || 'reported',
      level: inc.severity === 'critical' ? 'severe' : inc.severity || 'moderate',
    });
  });

  return (
    <Card
      title={t(language, 'alert_center')}
      action={
        <div className="flex gap-2">
          <button type="button" onClick={reloadRisk} className="p-1.5 glass rounded-lg hover:text-brand-to" aria-label="Refresh">
            <RefreshCw size={14} className={riskLoading ? 'animate-spin' : ''} />
          </button>
          {scenario ? (
            <button type="button" onClick={() => selectScenario(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg glass text-gray-200">
              <Radio size={12} /> {t(language, 'scenario_live')}
            </button>
          ) : (
            <button type="button" onClick={() => selectScenario('heavy_rain')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-from to-brand-to">
              <Send size={12} /> {t(language, 'simulate_alert')}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 max-h-[520px] overflow-y-auto">
        <AnimatePresence>
          {items.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle size={16} className="text-risk-high mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.description && <div className="text-xs text-gray-400 mt-1">{a.description}</div>}
                    {a.action && <div className="text-xs text-brand-to mt-2">→ {a.action}</div>}
                    {a.meta && <div className="text-[10px] text-gray-600 mt-2 mono">{a.meta}</div>}
                  </div>
                </div>
                <RiskBadge level={a.level} label={t(language, a.level)} />
              </div>
              {a.simulated && <div className="text-[10px] text-gray-600 mt-2 uppercase tracking-wide">Simulated (demo mode)</div>}
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && !riskLoading && <div className="text-sm text-gray-500 text-center py-8">{t(language, 'no_active_alerts')}</div>}
      </div>
    </Card>
  );
}

export function NotificationsCard() {
  const { language, location, user, showToast, setAccountOpen } = useWGPT();
  const currentLoc = { latitude: location.latitude, longitude: location.longitude, city: location.displayPrimary || location.city, country: location.country || '' };
  return (
    <Card title={t(language, 'notifications')}>
      <div className="wgpt-legacy text-sm">
        <NotificationSettings currentLoc={currentLoc} authenticatedUser={user} showToast={showToast} />
      </div>
      {!user && (
        <button type="button" onClick={() => setAccountOpen(true)} className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-from to-brand-to">
          {t(language, 'log_in')}
        </button>
      )}
    </Card>
  );
}

export function AccountCard() {
  const { language, user, setAccountOpen } = useWGPT();
  return (
    <Card title={t(language, 'account')}>
      <div className="flex items-center gap-3">
        {user?.profileImage
          ? <img src={user.profileImage} alt="" className="w-11 h-11 rounded-full object-cover border border-white/15" />
          : <UserCircle2 size={40} className="text-gray-500" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-100 truncate">{user?.name || t(language, 'log_in')}</div>
          <div className="text-xs text-gray-500 truncate">{user ? user.phone : 'Personalization, SMS alerts and push notifications'}</div>
        </div>
        <button type="button" onClick={() => setAccountOpen(true)} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">
          {user ? t(language, 'account') : t(language, 'log_in')}
        </button>
      </div>
    </Card>
  );
}

const STATUS_COLOR = { CONNECTED: 'text-risk-low', LIVE: 'text-risk-low', OK: 'text-risk-low', CONFIGURED: 'text-risk-low', DEGRADED: 'text-risk-moderate', 'NOT-CONFIGURED': 'text-gray-500', NOT_CONFIGURED: 'text-gray-500' };

export function SystemStatusCard() {
  const { language } = useWGPT();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => setStatus({ status: 'ERROR' }));
  }, []);

  const subsystems = Object.entries(status?.subsystems || {}).filter(([, info]) => info && typeof info === 'object');

  return (
    <Card
      title={t(language, 'system_status')}
      action={<span className={`mono text-xs ${STATUS_COLOR[status?.status] || 'text-gray-500'}`}>{status?.status || '…'}</span>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {subsystems.map(([name, info]) => (
          <div key={name} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-gray-300 capitalize"><Activity size={12} className="text-brand-to" />{name}</span>
            <span className={`mono ${STATUS_COLOR[info?.status] || 'text-gray-400'}`}>{info?.status || '—'}</span>
          </div>
        ))}
        {!status && <div className="h-24 animate-pulse bg-white/5 rounded-xl sm:col-span-2" />}
      </div>
      <Link href="/admin/ml" className="mt-3 inline-flex items-center gap-1 text-xs text-brand-to hover:text-white">
        {t(language, 'admin_ml')} <ExternalLink size={12} />
      </Link>
    </Card>
  );
}
