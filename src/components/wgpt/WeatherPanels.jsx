'use client';

import { motion } from 'framer-motion';
import { Wind, Droplets, Sun, Eye, RefreshCw, Scale, Sunrise, Sunset } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getWeatherEmoji, formatHourLabel } from '@/lib/weatherApi';
import { t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';
import { Card, PulseDot } from './ui';

function Metric({ icon, label, value }) {
  return (
    <div className="glass rounded-xl py-3 flex flex-col items-center gap-1 min-w-0">
      <div className="text-brand-to">{icon}</div>
      <div className="mono text-sm font-semibold truncate max-w-full px-1">{value}</div>
      <div className="text-[10px] uppercase text-gray-500 tracking-wide">{label}</div>
    </div>
  );
}

function clock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(11, 16) : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function WeatherHero() {
  const { weather, forecast, language, location, isFallbackMode, lastUpdatedTime, refreshCountdown, refreshWeather, isLoadingWeather, setCompareOpen } = useWGPT();

  if (!weather) {
    return (
      <Card title={t(language, 'current_conditions')}>
        {isLoadingWeather ? <div className="h-40 animate-pulse bg-white/5 rounded-xl" /> : <div className="text-sm text-gray-400">{t(language, 'weather_unavailable')}</div>}
      </Card>
    );
  }

  const rainChance = forecast?.hourly?.[0]?.precipProb ?? forecast?.daily?.[0]?.precipProb ?? 0;
  const today = forecast?.daily?.[0];
  const mins = Math.floor(refreshCountdown / 60);
  const secs = String(refreshCountdown % 60).padStart(2, '0');

  return (
    <Card
      title={t(language, 'current_conditions')}
      action={
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCompareOpen(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
            <Scale size={13} /> {t(language, 'compare')}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400 mono">
            <PulseDot />
            {t(language, 'source')}: {isFallbackMode ? 'open-meteo' : (weather.source || 'google')}
          </div>
        </div>
      }
    >
      <div className="text-sm text-gray-400 mb-2">
        {[...new Set([location.displayPrimary || location.city, ...String(location.displaySecondary || '').split(' · ')].filter(Boolean))].join(' · ')}
      </div>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div className="flex items-end gap-3">
          <span className="text-5xl leading-none" aria-hidden="true">{getWeatherEmoji(weather.condition)}</span>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mono text-6xl font-bold bg-gradient-to-r from-brand-from to-brand-to bg-clip-text text-transparent">
            {Math.round(weather.temp)}°
          </motion.div>
        </div>
        <div className="text-right">
          <div className="text-gray-300">{weather.condition}</div>
          <div className="text-sm text-gray-500">{t(language, 'feels_like')} {Math.round(weather.feelsLike)}°</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <Metric icon={<Droplets size={18} />} label={t(language, 'metric_rain')} value={`${rainChance}%`} />
        <Metric icon={<Wind size={18} />} label={t(language, 'metric_wind')} value={`${weather.windSpeed}km/h ${weather.windDirection || ''}`} />
        <Metric icon={<Droplets size={18} />} label={t(language, 'metric_humidity')} value={`${weather.humidity}%`} />
        <Metric icon={<Sun size={18} />} label={t(language, 'metric_uv')} value={`${weather.uvIndex ?? '-'}`} />
        <Metric icon={<Eye size={18} />} label={t(language, 'metric_visibility')} value={`${weather.visibility ?? '-'} km`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          {today?.sunriseTime && <span className="flex items-center gap-1"><Sunrise size={13} className="text-brand-to" />{t(language, 'sunrise')} {clock(today.sunriseTime)}</span>}
          {today?.sunsetTime && <span className="flex items-center gap-1"><Sunset size={13} className="text-brand-to" />{t(language, 'sunset')} {clock(today.sunsetTime)}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="mono">
            {lastUpdatedTime && `${t(language, 'updated')} ${lastUpdatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · `}
            {t(language, 'refresh_in')} {mins}:{secs}
          </span>
          <button type="button" onClick={refreshWeather} className="p-1.5 glass rounded-lg hover:text-brand-to" aria-label={t(language, 'refresh')}>
            <RefreshCw size={13} className={isLoadingWeather ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function ForecastChart() {
  const { forecast, language } = useWGPT();
  const rows = (forecast?.hourly || []).slice(0, 12).map((h) => ({
    time: formatHourLabel(h.time),
    temp: Math.round(h.temp),
    rain: h.precipProb,
  }));

  return (
    <Card title={t(language, 'forecast_next_12h')}>
      {rows.length === 0 ? (
        <div className="h-[220px] animate-pulse bg-white/5 rounded-xl" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis dataKey="time" stroke="#6B7280" fontSize={11} />
            <YAxis yAxisId="left" stroke="#3B82F6" fontSize={11} />
            <YAxis yAxisId="right" orientation="right" stroke="#14B8A6" fontSize={11} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 12 }} />
            <Bar yAxisId="right" dataKey="rain" fill="#14B8A6" radius={[4, 4, 0, 0]} opacity={0.5} name={t(language, 'forecast_rain_pct')} />
            <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#3B82F6" strokeWidth={2} dot={false} name={t(language, 'forecast_temp_c')} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function SevenDayForecast() {
  const { forecast, language } = useWGPT();
  const days = (forecast?.daily || []).slice(0, 7);
  if (!days.length) return null;

  return (
    <Card title={t(language, 'seven_day')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {days.map((d, i) => {
          const date = new Date(d.date);
          const label = i === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
          const rainColor = d.precipProb >= 70 ? 'bg-risk-severe' : d.precipProb >= 40 ? 'bg-risk-moderate' : 'bg-brand-to';
          return (
            <div key={d.date} className="glass rounded-xl p-3 text-center">
              <div className="text-xs font-semibold text-gray-300">{label}</div>
              <div className="text-2xl my-1.5" aria-hidden="true">{getWeatherEmoji(d.condition)}</div>
              <div className="mono text-sm font-semibold">{d.maxTemp}° <span className="text-gray-500 font-normal">{d.minTemp}°</span></div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className={`h-full ${rainColor} rounded-full`} style={{ width: `${d.precipProb}%` }} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{d.precipProb}% · {d.precipAmount ?? 0}mm</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
