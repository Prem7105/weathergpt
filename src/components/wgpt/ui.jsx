'use client';

import { motion } from 'framer-motion';
import { useWGPT } from './WeatherGPTProvider';
import { t } from '@/i18n';

export const RISK_COLORS = {
  low: '#22C55E', moderate: '#F59E0B', high: '#F97316', severe: '#EF4444', extreme: '#B91C1C',
};

export function Card({ title, children, action, className = '' }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PulseDot({ color = '#22C55E' }) {
  return <span className="pulse-dot" style={{ background: color, boxShadow: `0 0 0 0 ${color}80` }} />;
}

export function RiskBadge({ level, label }) {
  const color = RISK_COLORS[level] ?? '#6B7280';
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: `${color}22`, color, boxShadow: `0 0 12px ${color}33`, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

export function RiskGauge({ probability, level }) {
  const { language } = useWGPT();
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, Number(probability) || 0));
  const color = RISK_COLORS[level] ?? '#6B7280';

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="#1F2937" strokeWidth="14" fill="none" />
        <motion.circle
          cx="96" cy="96" r={radius} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="mono text-3xl font-bold" style={{ color }}>{Math.round(pct * 100)}%</span>
        <span className="text-xs uppercase tracking-widest text-gray-400 mt-1">{t(language, level)}</span>
      </div>
    </div>
  );
}

export function LoadingCard({ title }) {
  return <Card title={title}><div className="h-48 animate-pulse bg-white/5 rounded-xl" /></Card>;
}

export function MetricBlock({ icon, label, value }) {
  return (
    <div className="glass rounded-xl p-3 min-w-0">
      <div className="text-brand-to mb-2">{icon}</div>
      <div className="mono text-xl font-semibold text-gray-100 truncate">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function FactorBar({ label, value, detail }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-44 text-gray-400 capitalize truncate" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-from to-brand-to rounded-full" style={{ width: `${Math.min(100, (Number(value) || 0) * 200)}%` }} />
      </div>
      <span className="mono text-gray-500 w-24 text-right truncate">{detail ?? (Number(value) || 0).toFixed(2)}</span>
    </div>
  );
}

export function SourceTag({ source, status }) {
  return <span className="mono text-xs text-gray-500">{[source, status].filter(Boolean).join(' - ')}</span>;
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
