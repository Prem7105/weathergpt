'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Bell, Users, ShieldAlert, Clock, CloudRain, MessageCircle, Phone, Send, CheckCircle2, AlertTriangle, MapPinned, Radio } from 'lucide-react';
import { t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';
import { Card, RiskGauge, RiskBadge, LoadingCard, MetricBlock, FactorBar, SourceTag, formatTime } from './ui';

const SCENARIOS = [
  { key: null, label: 'scenario_live' },
  { key: 'heavy_rain', label: 'scenario_flood' },
  { key: 'heatwave', label: 'scenario_heat' },
  { key: 'storm', label: 'scenario_wind' },
];

function hazardName(hazard) {
  const name = String(hazard || 'weather').replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function ScenarioBar() {
  const { scenario, selectScenario, resetDemo, language } = useWGPT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-1">{t(language, 'intelligence_mode')}</span>
      {SCENARIOS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => selectScenario(s.key)}
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
            scenario === s.key ? 'bg-gradient-to-r from-brand-from to-brand-to text-white' : 'glass text-gray-400 hover:text-white'
          }`}
        >
          {t(language, s.label)}
        </button>
      ))}
      <button type="button" onClick={resetDemo} className="px-3 py-1.5 rounded-lg text-xs glass text-purple-300 hover:text-white">
        {t(language, 'reset_demo')}
      </button>
    </div>
  );
}

// The ML precipitation model only runs for flood assessments, so when another
// hazard dominates, ask /api/risk for the flood view just to show the forecast.
function useFloodMl(riskData, location, role) {
  const [floodMl, setFloodMl] = useState(null);
  const needsFetch = riskData && !riskData.ml?.enabled && riskData.dataStatus !== 'DEMO-SCENARIO';
  useEffect(() => {
    setFloodMl(null);
    if (!needsFetch || location.latitude == null) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ lat: location.latitude, lon: location.longitude, persona: role, hazard: 'flood' });
    fetch(`/api/risk?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.ml) setFloodMl(data.ml); })
      .catch(() => {});
    return () => controller.abort();
  }, [needsFetch, location.latitude, location.longitude, role, riskData?.assessedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return riskData?.ml?.enabled ? riskData.ml : (floodMl || riskData?.ml);
}

export function RiskPanel() {
  const { riskData, language, location, role } = useWGPT();
  const [showWhy, setShowWhy] = useState(false);
  const ml = useFloodMl(riskData, location, role);
  const risk = riskData?.risk;
  if (!risk) return <LoadingCard title={t(language, 'risk_intelligence')} />;

  const others = (risk.hazards || []).filter((h) => h.type !== risk.type);

  return (
    <div className="space-y-6">
      <Card title={t(language, 'risk_intelligence')} action={<SourceTag source={riskData.source} status={riskData.dataStatus} />}>
        <div className="mb-5"><ScenarioBar /></div>
        <div className="flex flex-col items-center">
          <RiskGauge probability={risk.score} level={risk.level} />
          <div className="mt-2 text-sm font-semibold text-gray-200 capitalize">{hazardName(risk.type)}</div>
          <div className="mt-1 text-xs text-gray-500 mono text-center">{risk.method}</div>
        </div>

        {others.length > 0 && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {others.map((h) => (
              <div key={h.type} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 capitalize">{hazardName(h.type)}</span>
                <RiskBadge level={h.level} label={`${Math.round(h.score * 100)}%`} />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="mt-4 w-full flex items-center justify-between text-sm text-brand-to hover:text-white transition-colors"
        >
          <span>{t(language, 'why_is_risk_high')}</span>
          <ChevronDown size={16} className={`transition-transform ${showWhy ? 'rotate-180' : ''}`} />
        </button>
        {showWhy && (
          <div className="mt-3 space-y-2">
            {(risk.factors || []).map((f) => <FactorBar key={f.label} label={f.label} value={f.contribution} detail={f.value} />)}
            {risk.cyclone?.message && <div className="text-xs text-gray-500 pt-1">{risk.cyclone.message}</div>}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3 text-sm">
            <div className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1"><Clock size={12} /> {t(language, 'peak_window')}</div>
            <div className="text-gray-200">{formatTime(risk.peakRisk?.time)} · <span className="capitalize">{risk.peakRisk?.level}</span> ({Math.round((risk.peakRisk?.score || 0) * 100)}%)</div>
          </div>
          <div className="glass rounded-xl p-3 text-sm">
            <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">{t(language, 'recommended_action')}</div>
            <div className="text-gray-200">{riskData.alert?.recommendedAction || risk.impactDecision?.decision?.recommendations?.[0] || '—'}</div>
          </div>
        </div>

        <Link href="/heatmap" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-to hover:text-white">
          <MapPinned size={15} /> {t(language, 'open_risk_map')} →
        </Link>
      </Card>

      <Card title={t(language, 'ml_forecast')} action={ml?.status && <span className="mono text-xs text-gray-500">{ml.status}</span>}>
        {ml?.enabled ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricBlock icon={<CloudRain size={18} />} label={t(language, 'next_hour_rain')} value={`${Number(ml.predictedPrecipitationMm).toFixed(2)} mm`} />
            <MetricBlock icon={<ShieldAlert size={18} />} label={ml.predictionInterval?.level || '90%'} value={`${ml.predictionInterval?.lower ?? 0}–${ml.predictionInterval?.upper ?? '?'} mm`} />
            <MetricBlock icon={<Radio size={18} />} label="Model" value={ml.algorithm?.split(' ')[0] || ml.model} />
          </div>
        ) : (
          <div className="text-sm text-gray-400">{ml?.reason || 'ML precipitation forecast unavailable.'}</div>
        )}
      </Card>
    </div>
  );
}

export function ImpactPanel() {
  const { riskData, language, location, role } = useWGPT();
  const risk = riskData?.risk;
  if (!risk) return <LoadingCard title={t(language, 'tab_impact')} />;
  const impact = risk.impactDecision || {};
  const incidents = riskData.incidents || {};

  return (
    <div className="space-y-6">
      <Card title={t(language, 'impact_assessment')} action={<SourceTag source={riskData.source} status={riskData.dataStatus} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricBlock icon={<ShieldAlert size={18} />} label={t(language, 'hazard_label')} value={hazardName(impact.hazard || risk.type)} />
          <MetricBlock icon={<Bell size={18} />} label={t(language, 'risk_label')} value={`${Math.round((impact.score ?? risk.score) * 100)}% ${impact.level || risk.level}`} />
          <MetricBlock icon={<Users size={18} />} label={t(language, 'role_label')} value={t(language, `role_${role}`)} />
        </div>
        <div className="mt-4 text-sm text-gray-400">{location.displayPrimary || location.city} · {formatTime(risk.valid_from)} → {formatTime(risk.valid_until)}</div>
      </Card>

      <Card title={t(language, 'physical_impacts')}>
        <div className="space-y-3">
          {(impact.impacts || []).map((item) => (
            <div key={item} className="glass rounded-xl p-3 text-sm text-gray-300 flex gap-2">
              <AlertTriangle size={15} className="text-risk-moderate mt-0.5 shrink-0" />{item}
            </div>
          ))}
          {!impact.impacts?.length && <div className="text-sm text-gray-500">—</div>}
        </div>
      </Card>

      <Card title={t(language, 'ground_reality')} action={<span className="mono text-xs text-gray-500">{incidents.dataStatus || riskData.dataStatus}</span>}>
        {incidents.dataStatus === 'DEGRADED' && !incidents.incidents?.length ? (
          <div className="text-sm text-gray-400">{t(language, 'incident_feed_degraded')}</div>
        ) : incidents.incidents?.length ? (
          <div className="space-y-3">
            {incidents.advisory && <div className="text-sm text-brand-to">{incidents.advisory}</div>}
            {incidents.incidents.map((inc) => (
              <div key={inc._id || inc.sourceId} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-200 capitalize">{inc.category} · {inc.location?.name}</div>
                  <RiskBadge level={inc.severity === 'critical' ? 'severe' : inc.severity || 'moderate'} label={inc.verification?.status || inc.severity || 'reported'} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{inc.source}{inc.distanceKm != null ? ` · ${Number(inc.distanceKm).toFixed(1)} km away` : ''}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">{t(language, 'no_incidents')}</div>
        )}
      </Card>
    </div>
  );
}

function OutcomeCard({ title, items, tone }) {
  const color = tone === 'danger' ? 'text-risk-severe' : 'text-risk-low';
  return (
    <div className="glass rounded-xl p-4">
      <div className={`font-semibold ${color}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => <div key={item} className="text-sm text-gray-400">{item}</div>)}
      </div>
    </div>
  );
}

export function DecisionPanel() {
  const { riskData, language } = useWGPT();
  const risk = riskData?.risk;
  if (!risk) return <LoadingCard title={t(language, 'tab_decision')} />;
  const decision = risk.impactDecision?.decision || {};
  const impacts = risk.impactDecision?.impacts || [];
  const recommendations = decision.recommendations || [];

  return (
    <div className="space-y-6">
      <Card title={t(language, 'decision_frame')} action={<span className="mono text-xs text-gray-500 uppercase">{t(language, 'priority')}: {decision.priority || '—'}</span>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OutcomeCard title={t(language, 'if_nothing_changes')} tone="danger" items={[`${Math.round(risk.score * 100)}% ${hazardName(risk.type)} risk remains active`, ...impacts.slice(0, 2)]} />
          <OutcomeCard title={t(language, 'if_action_now')} tone="good" items={recommendations.slice(0, 3)} />
        </div>
      </Card>

      <Card title={t(language, 'ranked_recommendations')}>
        <div className="space-y-3">
          {recommendations.map((action, index) => (
            <div key={action} className="flex gap-3 glass rounded-xl p-3">
              <div className="h-7 w-7 rounded-full bg-brand-to/15 text-brand-to mono text-xs flex items-center justify-center shrink-0">{index + 1}</div>
              <div className="text-sm text-gray-300">{action}</div>
            </div>
          ))}
        </div>
        {(decision.avoid?.length > 0 || decision.monitor?.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {decision.avoid?.length > 0 && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs uppercase tracking-wide text-risk-high mb-2">{t(language, 'avoid')}</div>
                {decision.avoid.map((a) => <div key={a} className="text-sm text-gray-400">• {a}</div>)}
              </div>
            )}
            {decision.monitor?.length > 0 && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs uppercase tracking-wide text-brand-to mb-2">{t(language, 'monitor')}</div>
                {decision.monitor.map((m) => <div key={m} className="text-sm text-gray-400">• {m}</div>)}
              </div>
            )}
          </div>
        )}
        {decision.escalation && <div className="mt-3 text-xs text-gray-500">{t(language, 'escalation')}: {decision.escalation}</div>}
      </Card>

      <Card title={t(language, 'contributing_evidence')}>
        <div className="space-y-3">
          {(risk.factors || []).map((f) => <FactorBar key={f.label} label={f.label} value={f.contribution} detail={f.value} />)}
        </div>
      </Card>
    </div>
  );
}

function smsPreview(alert) {
  if (!alert) return '';
  const level = String(alert.alertLevel || alert.level || 'HIGH').toUpperCase();
  const hazard = String(alert.hazard || 'WEATHER').toUpperCase();
  const action = alert.recommendedAction || alert.actions?.[0] || 'Monitor official updates and exercise caution.';
  const time = alert.expectedTime ? ` Peak: ${new Date(alert.expectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
  return `[WeatherGPT ${level} ${hazard} ALERT]${time} ${action} [Open-Meteo]`.slice(0, 160);
}

export function ActionPanel() {
  const { riskData, language, role, user, sendAlert, setAccountOpen } = useWGPT();
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(null);
  const alert = riskData?.alert;
  const message = useMemo(() => smsPreview(alert), [alert]);
  const risk = riskData?.risk;

  if (!risk) return <LoadingCard title={t(language, 'tab_action')} />;

  async function send(channel) {
    setSending(channel);
    setStatus(null);
    try {
      setStatus(await sendAlert({ channel, phoneNumber: phone }));
    } catch (err) {
      setStatus({ success: false, error: err.message });
    }
    setSending(null);
  }

  const canSend = phone.trim().length >= 8 && !sending;
  const actions = risk.impactDecision?.decision?.recommendations || alert?.actions || [];

  return (
    <div className="space-y-6">
      <Card title={t(language, 'action_message')} action={<SourceTag source={alert?.source} status={alert?.dataStatus} />}>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">{t(language, 'sms_preview')} · {message.length}/160</div>
        <div className="glass rounded-xl p-4 text-sm text-gray-300 leading-6 mono">{message}</div>
        {alert?.reason && <div className="mt-3 text-xs text-gray-500">{alert.reason}</div>}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricBlock icon={<ShieldAlert size={18} />} label={t(language, 'hazard_label')} value={hazardName(alert?.hazard || risk.type)} />
          <MetricBlock icon={<Bell size={18} />} label={t(language, 'risk_label')} value={`${Math.round((alert?.score ?? risk.score) * 100)}%`} />
          <MetricBlock icon={<Users size={18} />} label={t(language, 'role_label')} value={t(language, `role_${role}`)} />
        </div>
      </Card>

      <Card title={t(language, 'send_alert')}>
        {!user && (
          <div className="mb-3 text-xs text-amber-200/90">
            {t(language, 'login_to_send')}{' '}
            <button type="button" onClick={() => setAccountOpen(true)} className="underline text-brand-to">{t(language, 'log_in')}</button>
          </div>
        )}
        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2" htmlFor="delivery-phone">{t(language, 'recipient_phone')}</label>
        <input
          id="delivery-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-to"
        />
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <button type="button" disabled={!canSend} onClick={() => send('whatsapp')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-to px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40">
            <MessageCircle size={16} /> {sending === 'whatsapp' ? 'Sending' : 'WhatsApp'}
          </button>
          <button type="button" disabled={!canSend} onClick={() => send('sms')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-gray-100 disabled:opacity-40">
            <Phone size={16} /> {sending === 'sms' ? 'Sending' : 'SMS'}
          </button>
        </div>
        {status && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
            {status.success ? <CheckCircle2 size={16} className="mt-0.5 text-risk-low shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 text-risk-moderate shrink-0" />}
            <div className="min-w-0">
              <div className="font-medium">{status.mode ? String(status.mode).replace(/[-_]/g, ' ') : status.success ? 'Sent' : 'Not sent'}{status.provider ? ` · ${status.provider}` : ''}</div>
              {(status.note || status.error) && <div className="text-gray-500">{status.note || status.error}</div>}
              {status.messageId && <div className="mono text-xs text-gray-500">SID: {status.messageId}</div>}
            </div>
          </div>
        )}
      </Card>

      <Card title={t(language, 'next_actions')}>
        <div className="space-y-3">
          {actions.slice(0, 3).map((action) => (
            <div key={action} className="flex items-start gap-3 text-sm text-gray-300">
              <Send size={16} className="mt-0.5 text-brand-to shrink-0" />
              <span>{action}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
