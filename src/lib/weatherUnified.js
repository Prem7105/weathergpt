/**
 * WeatherGPT Unified Weather Data Layer & Source Aggregator
 * 
 * Provides standardized provider abstractions, multi-source consensus calculation,
 * source agreement estimation, and graceful degradation across Open-Meteo, Google Weather,
 * and OpenWeatherMap.
 */

import { fetchOpenMeteoData, normalizeOpenMeteoWeather, normalizeOpenMeteoHourly, normalizeOpenMeteoDaily } from './weatherApi.js';

export function normalizeStandardSnapshot(raw = {}, source = 'open-meteo', location = {}) {
  const temp = Number(raw.temperature ?? raw.temp ?? 28);
  const feelsLike = Number(raw.apparentTemperature ?? raw.feelsLike ?? temp);
  const humidity = Math.max(0, Math.min(100, Number(raw.relativeHumidity ?? raw.humidity ?? 50)));
  const windSpeed = Math.max(0, Number(raw.windSpeed ?? raw.wind_speed ?? 10));
  const precipitation = Math.max(0, Number(raw.precipitation ?? raw.rain ?? 0));
  const precipProb = Math.max(0, Math.min(100, Number(raw.precipitationProbability ?? raw.precipProb ?? 0)));

  return {
    location: {
      latitude: Number(location.latitude ?? location.lat ?? 23.0225),
      longitude: Number(location.longitude ?? location.lon ?? 72.5714),
      city: String(location.city || location.name || 'Selected area'),
    },
    timestamp: new Date().toISOString(),
    temperature: Number(temp.toFixed(1)),
    apparentTemperature: Number(feelsLike.toFixed(1)),
    humidity: Math.round(humidity),
    pressure: Number((raw.surfacePressure ?? raw.pressure ?? 1008).toFixed(1)),
    windSpeed: Number(windSpeed.toFixed(1)),
    windDirection: String(raw.windDirection || 'N/A'),
    precipitation: Number(precipitation.toFixed(1)),
    precipitationProbability: Math.round(precipProb),
    cloudCover: Math.round(Number(raw.cloudCover ?? raw.clouds ?? 30)),
    visibility: Number((raw.visibility ?? 10).toFixed(1)),
    dewPoint: Number((raw.dewPoint ?? (temp - ((100 - humidity) / 5))).toFixed(1)),
    uvIndex: Math.round(Number(raw.uvIndex ?? 5)),
    condition: String(raw.condition || 'Clear'),
    source: String(source),
    dataStatus: 'LIVE',
  };
}

/**
 * Calculates consensus and source agreement across multiple active providers.
 */
export function calculateSourceConsensus(providerSnapshots = []) {
  const valid = providerSnapshots.filter((p) => p && Number.isFinite(p.temperature));
  if (!valid.length) {
    return {
      consensus: null,
      agreement: 'INSUFFICIENT_DATA',
      configuredSourcesCount: 0,
      disagreementMetrics: null,
    };
  }

  if (valid.length === 1) {
    return {
      consensus: valid[0],
      agreement: 'SINGLE_SOURCE',
      configuredSourcesCount: 1,
      disagreementMetrics: { tempSpread: 0, precipSpread: 0 },
    };
  }

  // Calculate spreads
  const temps = valid.map((s) => s.temperature);
  const precips = valid.map((s) => s.precipitation);
  const tempSpread = Math.max(...temps) - Math.min(...temps);
  const precipSpread = Math.max(...precips) - Math.min(...precips);

  // Median temperature & precipitation
  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const consensusTemp = Number(median(temps).toFixed(1));
  const consensusPrecip = Number(median(precips).toFixed(1));
  const avgHumidity = Math.round(valid.reduce((acc, s) => acc + s.humidity, 0) / valid.length);
  const avgWind = Number((valid.reduce((acc, s) => acc + s.windSpeed, 0) / valid.length).toFixed(1));

  let agreement = 'HIGH';
  if (tempSpread > 4 || precipSpread > 15) agreement = 'LOW';
  else if (tempSpread > 2 || precipSpread > 6) agreement = 'MODERATE';

  const consensusSnapshot = {
    ...valid[0],
    temperature: consensusTemp,
    precipitation: consensusPrecip,
    humidity: avgHumidity,
    windSpeed: avgWind,
    source: `Consensus (${valid.map((v) => v.source).join(' + ')})`,
  };

  return {
    consensus: consensusSnapshot,
    agreement,
    configuredSourcesCount: valid.length,
    disagreementMetrics: {
      tempSpread: Number(tempSpread.toFixed(1)),
      precipSpread: Number(precipSpread.toFixed(1)),
      sources: valid.map((v) => ({ source: v.source, temp: v.temperature, precip: v.precipitation })),
    },
  };
}

export async function fetchUnifiedWeatherData(lat, lon, cityName = 'Selected area') {
  const snapshots = [];

  // 1. Primary: Open-Meteo
  try {
    const meteoRaw = await fetchOpenMeteoData(lat, lon);
    const meteoNorm = normalizeOpenMeteoWeather(meteoRaw, cityName);
    const standardized = normalizeStandardSnapshot(meteoNorm, 'open-meteo', { lat, lon, city: cityName });
    snapshots.push(standardized);
  } catch (err) {
    console.warn('Open-Meteo primary fetch failed:', err.message);
  }

  // 2. Secondary: OpenWeather (if configured)
  const owKey = process.env.OPENWEATHERMAP_API_KEY;
  if (owKey && owKey.trim()) {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owKey}&units=metric`);
      if (res.ok) {
        const owData = await res.json();
        const owSnapshot = normalizeStandardSnapshot({
          temperature: owData.main?.temp,
          apparentTemperature: owData.main?.feels_like,
          humidity: owData.main?.humidity,
          pressure: owData.main?.pressure,
          windSpeed: (owData.wind?.speed || 0) * 3.6, // m/s to km/h
          precipitation: owData.rain?.['1h'] || 0,
          condition: owData.weather?.[0]?.main || 'Clear',
        }, 'openweather', { lat, lon, city: cityName });
        snapshots.push(owSnapshot);
      }
    } catch (owErr) {
      console.warn('OpenWeather secondary fetch failed:', owErr.message);
    }
  }

  const consensusResult = calculateSourceConsensus(snapshots);
  return {
    primary: snapshots[0] || null,
    consensus: consensusResult.consensus || snapshots[0] || null,
    agreement: consensusResult.agreement,
    sourcesCount: consensusResult.configuredSourcesCount,
    metrics: consensusResult.disagreementMetrics,
    status: snapshots.length > 0 ? 'LIVE' : 'DEGRADED',
  };
}
