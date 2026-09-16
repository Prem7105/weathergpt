/**
 * WeatherGPT Edge Offline Storage & Cache Service
 * 
 * Manages local persistence of telemetry, risk intelligence, and decision models
 * ensuring full functionality even when internet access is disrupted.
 */

const STORAGE_KEY = 'weathergpt_edge_cache_v2';
const MAX_FRESH_MS = 60 * 60 * 1000; // 1 hour

export function saveEdgeState({ weather, forecast, risk, location, persona }) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      weather,
      forecast,
      risk,
      location,
      persona,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Unable to persist edge cache to localStorage:', err);
  }
}

export function loadEdgeState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ageMs = Date.now() - data.timestamp;
    const ageMinutes = Math.floor(ageMs / (60 * 1000));
    const isStale = ageMs > MAX_FRESH_MS;

    return {
      ...data,
      ageMinutes,
      isStale,
      lastSyncFormatted: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (err) {
    console.warn('Unable to load edge cache from localStorage:', err);
    return null;
  }
}
