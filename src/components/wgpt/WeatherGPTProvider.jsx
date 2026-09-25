'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { useGeolocation } from '@/hooks/useGeolocation';
import { geocodeAddress } from '@/lib/geocoding';
import { evaluateAlertStatus } from '@/lib/weatherApi';
import { buildSystemPrompt, executeClaudeRequest, formatWeatherForPrompt, generateSmartLocalResponse } from '@/lib/llmService';
import { loadEdgeState, saveEdgeState } from '@/lib/offlineStorage';
import { BACKEND_LANGUAGE } from '@/i18n';

const WeatherGPTContext = createContext(null);

export function useWGPT() {
  const ctx = useContext(WeatherGPTContext);
  if (!ctx) throw new Error('useWGPT must be used inside WeatherGPTProvider');
  return ctx;
}

const PREFS_KEY = 'wgpt_prefs_v1';
const HISTORY_KEY = 'wgpt_search_history';
const DEFAULT_HISTORY = ['New Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Bengaluru'];
const DEFAULT_LOCATION = {
  latitude: 19.076,
  longitude: 72.8777,
  city: 'Mumbai',
  displayPrimary: 'Mumbai',
  displaySecondary: 'Maharashtra · India',
  isGps: false,
};

function nowLabel() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function locationFromPlace(place, fallbackName) {
  const name = place.name || place.city || place.formattedAddress?.split(',')[0] || fallbackName;
  return {
    latitude: place.latitude ?? place.lat,
    longitude: place.longitude ?? place.lng,
    city: place.city || name,
    displayPrimary: name,
    displaySecondary: [...new Set([place.city || place.district, place.state, place.country].filter((part) => part && part !== name))].join(' · '),
    state: place.state || '',
    country: place.country || '',
    isGps: false,
  };
}

export default function WeatherGPTProvider({ children }) {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // ---------- Persisted preferences ----------
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState('citizen');
  const [language, setLanguage] = useState('en');
  const [onboarded, setOnboarded] = useState(false);
  const [location, setLocationState] = useState(DEFAULT_LOCATION);
  const [searchHistory, setSearchHistory] = useState(DEFAULT_HISTORY);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (saved) {
        if (saved.role) setRole(saved.role);
        if (saved.language) setLanguage(saved.language);
        if (saved.onboarded) setOnboarded(true);
        if (saved.location?.latitude != null) setLocationState(saved.location);
      }
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
      if (Array.isArray(history) && history.length) setSearchHistory(history);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ role, language, onboarded, location }));
    } catch {}
  }, [hydrated, role, language, onboarded, location]);

  const backendLanguage = BACKEND_LANGUAGE[language] || 'english';

  // ---------- Weather ----------
  const {
    weather, forecast, weatherAlerts, isFallbackMode, isLoadingWeather,
    lastUpdatedTime, refreshCountdown, setRefreshCountdown, fetchWeatherData,
  } = useWeather(showToast);

  useEffect(() => {
    if (!hydrated || location.latitude == null) return;
    fetchWeatherData(location.latitude, location.longitude, location.displayPrimary || location.city);
  }, [hydrated, location.latitude, location.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshWeather = useCallback(() => {
    if (location.latitude == null) return;
    fetchWeatherData(location.latitude, location.longitude, location.displayPrimary || location.city);
  }, [fetchWeatherData, location]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          refreshWeather();
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshWeather, setRefreshCountdown]);

  // ---------- Location ----------
  const rememberCity = useCallback((name) => {
    setSearchHistory((prev) => {
      const updated = [name, ...prev.filter((c) => c.toLowerCase() !== name.toLowerCase())].slice(0, 5);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const setLocation = useCallback((loc) => {
    if (loc?.latitude == null || loc?.longitude == null) return;
    setLocationState(loc);
  }, []);

  const selectPlace = useCallback((place, fallbackName = '') => {
    const loc = locationFromPlace(place, fallbackName);
    if (loc.latitude == null || loc.longitude == null) {
      showToast('Selected place is missing coordinates. Please choose another result.');
      return;
    }
    setLocation(loc);
    rememberCity(loc.displayPrimary);
  }, [rememberCity, setLocation, showToast]);

  const searchCity = useCallback(async (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const geo = await geocodeAddress(clean);
    if (!geo) {
      showToast(`Could not locate "${clean}". Please verify spelling.`);
      return;
    }
    selectPlace(geo, clean);
  }, [selectPlace, showToast]);

  const handleGpsDetected = useCallback((lat, lng, city) => {
    setLocation({ latitude: lat, longitude: lng, city, displayPrimary: city || 'Current location', displaySecondary: 'Live GPS', isGps: true });
  }, [setLocation]);
  const { gpsState, isDetectingLoc, runGpsDetect } = useGeolocation('', null, null, handleGpsDetected);
  const detectLocation = useCallback(() => runGpsDetect(showToast), [runGpsDetect, showToast]);

  // ---------- Auth ----------
  const [user, setUser] = useState(null);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [isCompareOpen, setCompareOpen] = useState(false);

  const handleAuthSuccess = useCallback((nextUser) => {
    setUser(nextUser);
    if (nextUser?.category) {
      setRole(nextUser.category === 'disaster_manager' ? 'disaster' : nextUser.category === 'other' ? 'citizen' : nextUser.category);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then(({ user: me }) => { if (me) handleAuthSuccess(me); })
      .catch(() => {});
  }, [handleAuthSuccess]);

  // ---------- Risk intelligence ----------
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [scenario, setScenario] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineSyncTime, setOfflineSyncTime] = useState(null);
  const latestState = useRef({});
  latestState.current = { weather, forecast, location };

  const loadRisk = useCallback(async () => {
    if (!hydrated || location.latitude == null) return;
    setRiskLoading(true);
    try {
      const params = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), persona: role || 'citizen' });
      if (scenario) params.set('scenario', scenario);
      const res = await fetch(`/api/risk?${params}`);
      if (!res.ok) throw new Error(`Risk service returned ${res.status}`);
      const data = await res.json();
      setRiskData(data);
      setIsOffline(false);
      const s = latestState.current;
      saveEdgeState({ weather: s.weather, forecast: s.forecast, risk: data, location: s.location, persona: role });
      setOfflineSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Risk intelligence fetch failed; loading edge cached state:', err);
      const cached = loadEdgeState();
      if (cached?.risk) {
        setRiskData(cached.risk);
        setIsOffline(true);
        setOfflineSyncTime(cached.lastSyncFormatted);
      }
    } finally {
      setRiskLoading(false);
    }
  }, [hydrated, location.latitude, location.longitude, role, scenario]);

  useEffect(() => { loadRisk(); }, [loadRisk]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Internet restored. Re-syncing live weather signals.');
      refreshWeather();
      loadRisk();
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Connection lost. Switched to edge offline intelligence mode.');
      const cached = loadEdgeState();
      if (cached?.risk) {
        setRiskData(cached.risk);
        setOfflineSyncTime(cached.lastSyncFormatted);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setIsOffline(true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadRisk, refreshWeather, showToast]);

  const selectScenario = useCallback((key) => {
    setScenario(key);
    showToast(key ? `Switched to ${key.replace('_', ' ')} demo scenario.` : 'Switched back to live weather data.');
  }, [showToast]);

  // ---------- Chat ----------
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [translatedMap, setTranslatedMap] = useState({});
  const sendingRef = useRef(false);

  const sendMessage = useCallback(async (text) => {
    const query = String(text || '').trim();
    if (!query || sendingRef.current) return;
    sendingRef.current = true;

    const userMsg = { role: 'user', content: query, time: nowLabel(), id: `${Date.now()}-${Math.random()}` };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const weatherSummary = weather ? formatWeatherForPrompt(weather, forecast) : 'Weather conditions unavailable.';
    const systemPrompt = buildSystemPrompt(role, backendLanguage, weatherSummary);
    const history = [...messages.slice(-8), userMsg].map((m) => ({ role: m.role, content: m.content }));
    const area = location.displayPrimary || location.city || 'Selected area';
    const riskContext = riskData?.risk
      ? { area, ...riskData.risk, ml: riskData.ml, alert: riskData.alert, source: riskData.source, dataStatus: riskData.dataStatus, assessedAt: riskData.assessedAt, incidents: riskData.incidents }
      : null;

    let answer;
    let usedLlm = true;
    try {
      answer = await executeClaudeRequest(systemPrompt, history, {
        persona: role,
        language: backendLanguage,
        weather,
        userQuery: query,
        forecast,
        risk: riskContext,
        impact: riskContext?.impactDecision?.impacts,
        decision: riskContext?.impactDecision?.decision,
        alert: riskContext?.alert,
        ml: riskContext?.ml,
        incidents: riskContext?.incidents,
      });
    } catch (err) {
      usedLlm = false;
      answer = generateSmartLocalResponse(role, backendLanguage, weather, query, forecast, {
        risk: riskContext || riskData?.risk,
        impact: riskContext?.impactDecision?.impacts,
        decision: riskContext?.impactDecision?.decision,
        alert: riskContext?.alert,
        incidents: riskContext?.incidents,
      });
    }

    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: answer,
      query,
      time: nowLabel(),
      id: `${Date.now()}-${Math.random()}`,
      usedLlm,
      source: isFallbackMode ? 'open-meteo' : (weather?.source || 'open-meteo'),
    }]);
    setIsTyping(false);
    sendingRef.current = false;
  }, [backendLanguage, forecast, isFallbackMode, location, messages, riskData, role, weather]);

  const toggleTranslate = useCallback(async (msg) => {
    if (translatedMap[msg.id]) {
      setTranslatedMap((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    let english = '';
    try {
      english = await executeClaudeRequest(
        'Translate the following Indian regional weather message to clear English. Output only the translation, no extra commentary.',
        [{ role: 'user', content: msg.content }]
      );
    } catch {
      english = generateSmartLocalResponse(role, 'english', weather, msg.query || msg.content, forecast);
    }
    if (english?.trim()) setTranslatedMap((prev) => ({ ...prev, [msg.id]: english.trim() }));
  }, [forecast, role, translatedMap, weather]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setTranslatedMap({});
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const resetDemo = useCallback(() => {
    setScenario('heavy_rain');
    setRole('citizen');
    setLanguage('en');
    setLocation({ latitude: 23.0225, longitude: 72.5714, city: 'Ahmedabad', displayPrimary: 'Ahmedabad', displaySecondary: 'Gujarat · India', isGps: false });
    clearChat();
    showToast('Golden demo reset: Ahmedabad heavy rain (flood risk).');
  }, [clearChat, setLocation, showToast]);

  // ---------- Alerts ----------
  const activeAlert = useMemo(
    () => evaluateAlertStatus(weather, weatherAlerts, forecast, backendLanguage),
    [weather, weatherAlerts, forecast, backendLanguage]
  );

  const sendAlert = useCallback(async ({ channel, phoneNumber }) => {
    const res = await fetch('/api/alerts/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        channel,
        alert: riskData?.alert || { alertLevel: 'HIGH', hazard: 'flood', recommendedAction: 'Avoid affected routes and low-lying underpasses.' },
        persona: role,
        language: backendLanguage,
        forceSimulated: !user,
      }),
    });
    const data = await res.json().catch(() => ({ error: 'Alert dispatch failed.' }));
    return { ...data, httpStatus: res.status };
  }, [backendLanguage, riskData, role, user]);

  const value = {
    hydrated, showToast, toast,
    role, setRole, language, setLanguage, backendLanguage, onboarded, completeOnboarding: () => setOnboarded(true),
    location, setLocation, selectPlace, searchCity, searchHistory, detectLocation, gpsState, isDetectingLoc,
    weather, forecast, weatherAlerts, isFallbackMode, isLoadingWeather, lastUpdatedTime, refreshCountdown, refreshWeather,
    riskData, riskLoading, scenario, selectScenario, resetDemo, isOffline, offlineSyncTime, reloadRisk: loadRisk,
    messages, isTyping, sendMessage, translatedMap, toggleTranslate, clearChat,
    activeAlert, sendAlert,
    user, handleAuthSuccess, setUser, isAccountOpen, setAccountOpen, isCompareOpen, setCompareOpen,
  };

  return <WeatherGPTContext.Provider value={value}>{children}</WeatherGPTContext.Provider>;
}
