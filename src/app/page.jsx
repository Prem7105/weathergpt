'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { UI_I18N } from '@/lib/i18n';
import { geocodeAddress, searchLocationAutocomplete } from '@/lib/geocoding';
import { formatNativeNumber, getBackgroundTintClass, getWeatherEmoji, evaluateAlertStatus } from '@/lib/weatherApi';
import {
  formatWeatherForPrompt,
  buildSystemPrompt,
  executeClaudeRequest,
  generateSmartLocalResponse
} from '@/lib/llmService';

import { useGeolocation } from '@/hooks/useGeolocation';
import { useWeather } from '@/hooks/useWeather';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';
import ChatArea from '@/components/Chat/ChatArea';
import QuickChips from '@/components/Chat/QuickChips';
import InputBar from '@/components/Chat/InputBar';
import SevenDayForecast from '@/components/Forecast/SevenDayForecast';
import HourlyForecast from '@/components/Forecast/HourlyForecast';
import GpsOverlay from '@/components/Modals/GpsOverlay';
import CompareModal from '@/components/Modals/CompareModal';
import SettingsModal from '@/components/Modals/SettingsModal';
import AccountModal from '@/components/Modals/AccountModal';
import AlertBanner from '@/components/UI/AlertBanner';
import Toast from '@/components/UI/Toast';
import ErrorBoundary from '@/components/UI/ErrorBoundary';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import RiskIntelligenceCard from '@/components/Risk/RiskIntelligenceCard';
import { saveEdgeState, loadEdgeState } from '@/lib/offlineStorage';

function getCurrentTimestamp() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function WeatherGptHome() {
  // Toast state
  const [toastMsg, setToastMsg] = useState(null);
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // Weather Hook
  const {
    weather,
    forecast,
    weatherAlerts,
    isFallbackMode,
    isLoadingWeather,
    lastUpdatedTime,
    refreshCountdown,
    setRefreshCountdown,
    fetchWeatherData
  } = useWeather(showToast);

  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Geolocation Hook
  const handleGpsDetected = useCallback((lat, lng, city) => {
    fetchWeatherData(lat, lng, city);
    if (!authenticatedUser) {
      setIsAccountOpen(true);
    }
  }, [authenticatedUser, fetchWeatherData]);

  const {
    currentLoc,
    setCurrentLoc,
    gpsState,
    setGpsState,
    isDetectingLoc,
    runGpsDetect,
    handleSkipGps
  } = useGeolocation('', null, null, handleGpsDetected);

  // Search History
  const [searchInput, setSearchInput] = useState('');
  const [searchHistory, setSearchHistory] = useState(['New Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Bengaluru']);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('wgpt_search_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSearchHistory(parsed);
          }
        }
      } catch (err) {}
    }
  }, []);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  const [showNoLocationResults, setShowNoLocationResults] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(-1);
  const locationAbortRef = useRef(null);
  // Set right before a programmatic setSearchInput() so the live-suggestions
  // effect below doesn't immediately re-search the name we just resolved.
  const suppressNextSuggestSearchRef = useRef(false);

  // Persona & Language
  const [selectedPersona, setSelectedPersona] = useState('citizen');
  const [selectedLanguage, setSelectedLanguage] = useState('hindi');
  const i18n = useMemo(() => UI_I18N[selectedLanguage] || UI_I18N.english, [selectedLanguage]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [translatedMap, setTranslatedMap] = useState({});

  // Modals & Panels
  const [showSevenDay, setShowSevenDay] = useState(false);
  const [showTwentyFourHr, setShowTwentyFourHr] = useState(false);
  const [alertBannerDismissed, setAlertBannerDismissed] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // TTS Speech Hook
  const { activeSpeakingId, toggleListen } = useSpeechSynthesis(selectedLanguage);

  const handleAuthSuccess = useCallback((user) => {
    setAuthenticatedUser(user);
    if (user?.category) {
      setSelectedPersona(user.category === 'disaster_manager' ? 'disaster' : user.category === 'other' ? 'citizen' : user.category);
    }
  }, []);

  const [riskData, setRiskData] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineSyncTime, setOfflineSyncTime] = useState(null);

  const loadRiskIntelligence = useCallback(async (lat, lon, persona, scenario = null) => {
    if (lat == null || lon == null) return;
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        persona: persona || 'citizen'
      });
      if (scenario) params.set('scenario', scenario);
      const res = await fetch(`/api/risk?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRiskData(data);
        saveEdgeState({
          weather,
          forecast,
          risk: data,
          location: currentLoc,
          persona
        });
        setOfflineSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.warn('Risk intelligence fetch failed; loading edge cached state:', err);
      const cached = loadEdgeState();
      if (cached?.risk) {
        setRiskData(cached.risk);
        setIsOffline(true);
        setOfflineSyncTime(cached.lastSyncFormatted);
      }
    }
  }, [currentLoc, forecast, weather]);

  useEffect(() => {
    if (currentLoc.latitude != null && currentLoc.longitude != null) {
      loadRiskIntelligence(currentLoc.latitude, currentLoc.longitude, selectedPersona, activeScenario);
    }
  }, [currentLoc.latitude, currentLoc.longitude, selectedPersona, activeScenario, loadRiskIntelligence]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('🌐 Internet restored. Re-syncing live weather signals.');
      if (currentLoc.latitude != null && currentLoc.longitude != null) {
        fetchWeatherData(currentLoc.latitude, currentLoc.longitude, currentLoc.city);
        loadRiskIntelligence(currentLoc.latitude, currentLoc.longitude, selectedPersona, activeScenario);
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('📡 Connection lost. Switched to Edge Offline Intelligence Mode.');
      const cached = loadEdgeState();
      if (cached?.risk) {
        setRiskData(cached.risk);
        setOfflineSyncTime(cached.lastSyncFormatted);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof navigator !== 'undefined' && !navigator.onLine) setIsOffline(true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentLoc, fetchWeatherData, loadRiskIntelligence, selectedPersona, activeScenario, showToast]);

  const handleSimulateSms = useCallback(async () => {
    const res = await fetch('/api/alerts/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+919876543210',
        alert: riskData?.alert || { alertLevel: 'HIGH', hazard: 'flood', recommendedAction: 'Avoid affected routes and low-lying underpasses.' },
        persona: selectedPersona,
        language: selectedLanguage,
        forceSimulated: true
      })
    });
    return await res.json();
  }, [riskData, selectedPersona, selectedLanguage]);

  const handleSelectScenario = useCallback((scenarioKey) => {
    setActiveScenario(scenarioKey);
    if (scenarioKey) {
      showToast(`⚡ Switched to ${scenarioKey.replace('_', ' ').toUpperCase()} scenario.`);
    } else {
      showToast('🌐 Switched back to LIVE weather data.');
    }
  }, [showToast]);

  const handleResetDemo = useCallback(() => {
    setActiveScenario('heavy_rain');
    setSelectedPersona('citizen');
    setSelectedLanguage('english');
    setCurrentLoc({
      city: 'Ahmedabad',
      displayPrimary: 'Ahmedabad',
      displaySecondary: 'Gujarat, India',
      latitude: 23.0225,
      longitude: 72.5714,
    });
    setMessages([]);
    setTextInput('');
    setAlertBannerDismissed(false);
    showToast('🔄 Golden Demo Scenario reset: Ahmedabad Heavy Rain (Flood Risk).');
  }, [showToast, setCurrentLoc]);

  // Send message callback
  const handleSendMessage = useCallback(async (textToSend, personaOverride) => {
    const query = (textToSend || textInput).trim();
    if (!query || isSending) return;

    const resolvedPersona = personaOverride || selectedPersona || 'citizen';

    const userMsg = {
      role: 'user',
      content: query,
      time: getCurrentTimestamp(),
      id: Date.now() + Math.random()
    };

    setMessages((prev) => [...prev, userMsg]);
    setTextInput('');

    setIsSending(true);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 250));

    let generatedAnswer = '';
    const weatherSummary = weather ? formatWeatherForPrompt(weather, forecast) : 'Weather conditions unavailable.';
    const systemPrompt = buildSystemPrompt(resolvedPersona, selectedLanguage, weatherSummary);
    const historyForClaude = [...messages.slice(-8), userMsg].map((m) => ({ role: m.role, content: m.content }));
    let riskContext = riskData?.risk ? { area: currentLoc.displayPrimary || currentLoc.city || 'Selected area', ...riskData.risk, ml: riskData.ml, alert: riskData.alert, source: riskData.source, dataStatus: riskData.dataStatus, assessedAt: riskData.assessedAt, incidents: riskData.incidents } : null;
    
    if (!riskContext && currentLoc.latitude != null && currentLoc.longitude != null) {
      try {
        const scenarioParam = activeScenario ? `&scenario=${activeScenario}` : '';
        const riskResponse = await fetch(`/api/risk?lat=${currentLoc.latitude}&lon=${currentLoc.longitude}&persona=${resolvedPersona}${scenarioParam}`);
        if (riskResponse.ok) {
          const riskPayload = await riskResponse.json();
          const liveRisk = riskPayload.risk;
          riskContext = { area: currentLoc.displayPrimary || currentLoc.city || 'Selected area', ...liveRisk, ml: riskPayload.ml, alert: riskPayload.alert, source: riskPayload.source, dataStatus: riskPayload.dataStatus, assessedAt: riskPayload.assessedAt, incidents: riskPayload.incidents };
        }
      } catch (riskError) {
        console.warn('Risk context unavailable for AI advisory:', riskError);
      }
    }

    try {
      generatedAnswer = await executeClaudeRequest(systemPrompt, historyForClaude, {
        persona: resolvedPersona,
        language: selectedLanguage,
        weather,
        userQuery: query,
        forecast,
        risk: riskContext,
        impact: riskContext?.impactDecision?.impacts,
        decision: riskContext?.impactDecision?.decision,
        alert: riskContext?.alert,
        ml: riskContext?.ml,
        incidents: riskContext?.incidents
      });
    } catch (apiErr) {
      console.info('Using local meteorological reasoning engine:', apiErr.message);
      generatedAnswer = generateSmartLocalResponse(resolvedPersona, selectedLanguage, weather, query, forecast, {
        risk: riskContext || riskData?.risk || riskData,
        impact: riskContext?.impactDecision?.impacts || riskData?.risk?.impactDecision?.impacts,
        decision: riskContext?.impactDecision?.decision || riskData?.risk?.impactDecision?.decision,
        alert: riskContext?.alert || riskData?.alert,
        incidents: riskContext?.incidents || riskData?.incidents
      });
    }

    const aiMsg = {
      role: 'assistant',
      content: generatedAnswer,
      query: query,
      time: getCurrentTimestamp(),
      id: Date.now() + Math.random(),
      source: isFallbackMode ? 'open-meteo' : 'google'
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
    setIsSending(false);
  }, [textInput, isSending, messages, weather, forecast, selectedPersona, selectedLanguage, isFallbackMode, currentLoc, riskData, activeScenario]);

  // STT Speech Recognition Hook
  const { micStatus, toggleMicrophone } = useSpeechRecognition(
    selectedLanguage,
    (finalTranscript) => handleSendMessage(finalTranscript),
    showToast
  );

  // Active Alert Info
  const activeAlert = useMemo(
    () => evaluateAlertStatus(weather, weatherAlerts, forecast, selectedLanguage),
    [weather, weatherAlerts, forecast, selectedLanguage]
  );

  // Initial Mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.ok ? response.json() : { user: null })
      .then(({ user }) => {
        if (user) handleAuthSuccess(user);
      })
      .catch(() => {});

    if (gpsState === 'unsupported' && currentLoc.latitude != null && currentLoc.longitude != null) {
      fetchWeatherData(currentLoc.latitude, currentLoc.longitude, currentLoc.city);
    }
  }, [handleAuthSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // 10-Minute Auto-Refresh Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          if (currentLoc.latitude != null && currentLoc.longitude != null) {
            fetchWeatherData(currentLoc.latitude, currentLoc.longitude, currentLoc.city);
          }
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentLoc, fetchWeatherData, setRefreshCountdown]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleMicrophone(setTextInput);
      }
      if (e.key === 'Escape') {
        if (isCompareOpen) setIsCompareOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isAccountOpen) setIsAccountOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompareOpen, isSettingsOpen, isAccountOpen, toggleMicrophone]);

  // Location Search Handler
  const handleLocationSuggestionSelect = useCallback((suggestion) => {
    if (!suggestion) return;

    const displayName = suggestion.name || suggestion.city || suggestion.formattedAddress?.split(',')[0] || searchInput;
    const lat = suggestion.latitude ?? suggestion.lat;
    const lng = suggestion.longitude ?? suggestion.lng;

    if (lat == null || lng == null) {
      showToast('⚠️ Selected place is missing coordinates. Please choose another result.');
      return;
    }

    setCurrentLoc({
      latitude: lat,
      longitude: lng,
      accuracy: null,
      address: suggestion.formattedAddress || displayName,
      displayPrimary: displayName,
      displaySecondary: [suggestion.city || suggestion.district, suggestion.state, suggestion.country].filter(Boolean).join(' · '),
      city: suggestion.city || displayName,
      district: suggestion.district || '',
      state: suggestion.state || '',
      country: suggestion.country || '',
      postalCode: suggestion.postalCode || '',
      placeId: suggestion.placeId || '',
      name: displayName,
      formattedAddress: suggestion.formattedAddress || displayName,
      source: 'search',
      isGps: false,
      detail: suggestion.state || suggestion.district || suggestion.country || ''
    });

    suppressNextSuggestSearchRef.current = true;
    setSearchInput(displayName);
    setLocationSuggestions([]);
    setLocationSearchError('');
    setShowNoLocationResults(false);
    setActiveLocationIndex(-1);
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== displayName.toLowerCase());
      const updated = [displayName, ...filtered].slice(0, 5);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wgpt_search_history', JSON.stringify(updated));
        } catch (err) {}
      }
      return updated;
    });
    fetchWeatherData(lat, lng, displayName);
    setMobileSidebarOpen(false);
  }, [fetchWeatherData, searchInput, showToast, setCurrentLoc]);

  const handleExecuteSearch = useCallback(async (targetCity) => {
    if (!targetCity || !targetCity.trim()) return;
    const clean = targetCity.trim();
    const geo = await geocodeAddress(clean);

    if (geo) {
      const lat = geo.latitude ?? geo.lat;
      const lng = geo.longitude ?? geo.lng;
      const displayName = geo.name || geo.city || clean;

      setCurrentLoc({
        latitude: lat,
        longitude: lng,
        accuracy: null,
        address: geo.formattedAddress || geo.city || displayName,
        displayPrimary: displayName,
        displaySecondary: [geo.city || geo.district, geo.state, geo.country].filter(Boolean).join(' · '),
        city: geo.city || displayName,
        district: geo.district || '',
        state: geo.state || '',
        country: geo.country || '',
        postalCode: geo.postalCode || '',
        placeId: geo.placeId || '',
        name: displayName,
        formattedAddress: geo.formattedAddress || displayName,
        source: 'search',
        isGps: false,
        detail: geo.state || geo.district || geo.country || ''
      });
      suppressNextSuggestSearchRef.current = true;
      setSearchInput(displayName);
      setLocationSuggestions([]);
      setLocationSearchError('');
      setShowNoLocationResults(false);
      setActiveLocationIndex(-1);
      setSearchHistory((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== displayName.toLowerCase());
        const updated = [displayName, ...filtered].slice(0, 5);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('wgpt_search_history', JSON.stringify(updated));
          } catch (err) {}
        }
        return updated;
      });
      fetchWeatherData(lat, lng, displayName);
      setMobileSidebarOpen(false);
    } else {
      showToast(`❌ Could not locate "${clean}". Please verify spelling.`);
    }
  }, [fetchWeatherData, showToast, setCurrentLoc]);

  const handleLocationInputChange = useCallback((value) => {
    setSearchInput(value);
    if (!value.trim() || value.trim().length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError('');
      setShowNoLocationResults(false);
      setActiveLocationIndex(-1);
      return;
    }
  }, []);

  const handleLocationKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown' && locationSuggestions.length > 0) {
      event.preventDefault();
      setActiveLocationIndex((prev) => (prev < locationSuggestions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp' && locationSuggestions.length > 0) {
      event.preventDefault();
      setActiveLocationIndex((prev) => (prev > 0 ? prev - 1 : locationSuggestions.length - 1));
      return;
    }

    if (event.key === 'Enter') {
      if (locationSuggestions.length > 0 && activeLocationIndex >= 0) {
        event.preventDefault();
        handleLocationSuggestionSelect(locationSuggestions[activeLocationIndex]);
        return;
      }
      if (searchInput.trim()) {
        event.preventDefault();
        handleExecuteSearch(searchInput);
      }
      return;
    }

    if (event.key === 'Escape') {
      setLocationSuggestions([]);
      setActiveLocationIndex(-1);
      setLocationSearchError('');
      setShowNoLocationResults(false);
    }
  }, [activeLocationIndex, handleExecuteSearch, handleLocationSuggestionSelect, locationSuggestions, searchInput]);

  useEffect(() => {
    if (suppressNextSuggestSearchRef.current) {
      suppressNextSuggestSearchRef.current = false;
      return undefined;
    }

    const query = searchInput.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError('');
      setShowNoLocationResults(false);
      setActiveLocationIndex(-1);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      if (locationAbortRef.current) {
        locationAbortRef.current.abort();
      }

      const controller = new AbortController();
      locationAbortRef.current = controller;
      setIsLocationSearching(true);
      setLocationSearchError('');

      try {
        const results = await searchLocationAutocomplete(query, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setLocationSuggestions(results);
        setShowNoLocationResults(results.length === 0);
        setActiveLocationIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLocationSuggestions([]);
        setShowNoLocationResults(false);
        setLocationSearchError('Unable to search locations');
        setActiveLocationIndex(-1);
      } finally {
        if (!controller.signal.aborted) {
          setIsLocationSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (locationAbortRef.current) {
        locationAbortRef.current.abort();
      }
    };
  }, [searchInput]);

  // Translation handler
  const handleToggleTranslate = async (msg) => {
    if (!msg || !msg.id) return;

    if (translatedMap[msg.id]) {
      setTranslatedMap((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }

    try {
      const trans = await executeClaudeRequest(
        'Translate the following Indian regional weather message to clear English. Output only the translation, no extra commentary.',
        [{ role: 'user', content: msg.content }]
      );
      if (trans && trans.trim()) {
        setTranslatedMap((prev) => ({ ...prev, [msg.id]: trans.trim() }));
        return;
      }
    } catch (err) {
      console.info('LLM translation not available, using local engine:', err.message);
    }

    try {
      const userQuery = msg.query || '';
      const engText = generateSmartLocalResponse(selectedPersona, 'english', weather, userQuery || msg.content, forecast);
      setTranslatedMap((prev) => ({ ...prev, [msg.id]: engText }));
    } catch (e) {
      console.warn('Translation engine error:', e);
      const w = weather || {};
      const isRainy = (w.condition || '').toLowerCase().includes('rain') || (w.humidity || 0) > 75;
      const basicSummary = `Weather for ${w.city || 'your area'}: ${w.temp || 28}°C, ${w.condition || 'Clear'}.\n` +
        `Humidity: ${w.humidity || 55}% | Wind: ${w.windSpeed || 12} km/h | UV: ${w.uvIndex || 5}\n\n` +
        (isRainy ? '🌧️ Rain is expected — carry an umbrella!' : '😊 Pleasant weather conditions for outdoor activities.');
      setTranslatedMap((prev) => ({ ...prev, [msg.id]: basicSummary }));
    }
  };

  const handleCopyText = (msg) => {
    navigator.clipboard.writeText(msg.content)
      .then(() => showToast('📋 Copied to clipboard!'))
      .catch(() => showToast('Failed to copy.'));
  };

  const handleShareWeather = (msg) => {
    const sharePayload = `WeatherGPT (${currentLoc.city}):\n${msg.content}\n\n[Powered by WeatherGPT • Smart India Hackathon 2026]`;
    navigator.clipboard.writeText(sharePayload)
      .then(() => showToast('📤 Weather report copied for sharing!'))
      .catch(() => showToast('Failed to copy share text.'));
  };

  const handleClearConversation = () => {
    setMessages([]);
    setTranslatedMap({});
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    showToast('🗑️ Conversation history cleared.');
  };

  const backgroundTint = weather ? getBackgroundTintClass(weather.condition, weather.isDaytime) : 'clear';

  return (
    <ErrorBoundary>
      <div className="app-wrapper">
        <PWAInstallPrompt />
        {/* GPS Permission / Signal Acquisition Overlay */}
        <GpsOverlay
          gpsState={gpsState}
          onAllowGps={() => runGpsDetect(showToast)}
          onSkipGps={handleSkipGps}
        />

        {/* Mobile Hamburger Toggle */}
        <button
          className="mobile-nav-toggle"
          id="mobile-nav-toggle"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          title="Toggle Menu"
        >
          {mobileSidebarOpen ? '✕' : '☰'}
        </button>

        {/* Mobile Backdrop Overlay */}
        <div
          className={`mobile-backdrop-overlay ${mobileSidebarOpen ? 'active' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
        />

        {/* Sidebar */}
        <Sidebar
          mobileSidebarOpen={mobileSidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleExecuteSearch}
          onLocationInputChange={handleLocationInputChange}
          onLocationKeyDown={handleLocationKeyDown}
          locationSuggestions={locationSuggestions}
          isSearchingLocation={isLocationSearching}
          locationSearchError={locationSearchError}
          showNoLocationResults={showNoLocationResults}
          activeLocationIndex={activeLocationIndex}
          onSuggestionSelect={handleLocationSuggestionSelect}
          searchHistory={searchHistory}
          currentLoc={currentLoc}
          gpsState={gpsState}
          isDetectingLoc={isDetectingLoc}
          onDetectLocation={() => runGpsDetect(showToast)}
          selectedPersona={selectedPersona}
          setSelectedPersona={setSelectedPersona}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          i18n={i18n}
          weather={weather}
          forecast={forecast}
          isLoadingWeather={isLoadingWeather}
          lastUpdatedTime={lastUpdatedTime}
          refreshCountdown={refreshCountdown}
          onRefreshWeather={() => currentLoc.latitude != null && fetchWeatherData(currentLoc.latitude, currentLoc.longitude, currentLoc.city)}
        />

        {/* Main Viewport */}
        <main className="main-viewport" id="main-viewport">
          {/* Top Alert Banner */}
          <AlertBanner
            activeAlert={activeAlert}
            currentLoc={currentLoc}
            isDismissed={alertBannerDismissed}
            onDismiss={() => setAlertBannerDismissed(true)}
          />

          {/* Header */}
          <Header
            currentLoc={currentLoc}
            weather={weather}
            i18n={i18n}
            isCompareOpen={isCompareOpen}
            onOpenCompare={() => setIsCompareOpen(true)}
            onClearChat={handleClearConversation}
            onOpenAccount={() => setIsAccountOpen(true)}
            authenticatedUser={authenticatedUser}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {weather && (
            <section className="weather-overview" aria-label="Current weather overview">
              <div className="weather-overview-main">
                <div className="weather-overview-kicker">Current conditions</div>
                <div className="weather-overview-location">{currentLoc.displayPrimary || currentLoc.city}</div>
                <div className="weather-overview-reading">
                  <span className="weather-overview-icon" aria-hidden="true">{getWeatherEmoji(weather.condition)}</span>
                  <span className="weather-overview-temp">{formatNativeNumber(weather.temp, selectedLanguage)}°</span>
                  <div className="weather-overview-condition">
                    <strong>{weather.condition}</strong>
                    <span>Feels like {formatNativeNumber(weather.feelsLike, selectedLanguage)}°</span>
                  </div>
                </div>
              </div>
              <div className="weather-overview-metrics">
                <div><span>Humidity</span><strong>{formatNativeNumber(weather.humidity, selectedLanguage)}%</strong></div>
                <div><span>Wind</span><strong>{formatNativeNumber(weather.windSpeed, selectedLanguage)} km/h</strong></div>
                <div><span>Rain chance</span><strong>{formatNativeNumber(forecast?.hourly?.[0]?.precipProb || forecast?.daily?.[0]?.precipProb || 0, selectedLanguage)}%</strong></div>
                <div><span>UV index</span><strong>{formatNativeNumber(weather.uvIndex, selectedLanguage)}</strong></div>
              </div>
            </section>
          )}

          {/* Risk, Impact & Decision Intelligence Panel */}
          {riskData && (
            <RiskIntelligenceCard
              riskData={riskData}
              persona={selectedPersona}
              language={selectedLanguage}
              onSelectScenario={handleSelectScenario}
              onResetDemo={handleResetDemo}
              activeScenario={activeScenario}
              onSimulateSms={handleSimulateSms}
              isOffline={isOffline}
              offlineSyncTime={offlineSyncTime}
            />
          )}

          {/* Chat Messages */}
          <ChatArea
            messages={messages}
            backgroundTint={backgroundTint}
            isTyping={isTyping}
            currentLoc={currentLoc}
            selectedPersona={selectedPersona}
            i18n={i18n}
            activeSpeakingId={activeSpeakingId}
            translatedMap={translatedMap}
            onSelectStarter={(personaKey, q) => {
              setSelectedPersona(personaKey);
              handleSendMessage(q, personaKey);
            }}
            onToggleListen={toggleListen}
            onCopyText={handleCopyText}
            onShareWeather={handleShareWeather}
            onToggleTranslate={handleToggleTranslate}
          />

          {/* Forecast Panel Toggles */}
          <div className="forecast-toggles-bar">
            <button
              id="toggle-7day-btn"
              className={`toggle-forecast-btn ${showSevenDay ? 'active' : ''}`}
              onClick={() => {
                setShowSevenDay(!showSevenDay);
                if (!showSevenDay) setShowTwentyFourHr(false);
              }}
            >
              <span>📅</span> {i18n.forecast7}
            </button>
            <button
              id="toggle-24hr-btn"
              className={`toggle-forecast-btn ${showTwentyFourHr ? 'active' : ''}`}
              onClick={() => {
                setShowTwentyFourHr(!showTwentyFourHr);
                if (!showTwentyFourHr) setShowSevenDay(false);
              }}
            >
              <span>🕐</span> {i18n.forecast24}
            </button>
          </div>

          {/* Forecast Sliders */}
          {showSevenDay && (
            <SevenDayForecast
              forecast={forecast}
              selectedLanguage={selectedLanguage}
              i18n={i18n}
            />
          )}

          {showTwentyFourHr && (
            <HourlyForecast forecast={forecast} selectedLanguage={selectedLanguage} />
          )}

          {/* Quick Question Chips */}
          <QuickChips
            selectedPersona={selectedPersona}
            i18n={i18n}
            onChipClick={(chip) => handleSendMessage(chip)}
          />

          {/* Input Bar */}
          <InputBar
            textInput={textInput}
            setTextInput={setTextInput}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            micStatus={micStatus}
            onToggleMicrophone={() => toggleMicrophone(setTextInput)}
            i18n={i18n}
          />
        </main>

        {/* Compare Cities Modal */}
        <CompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          currentLoc={currentLoc}
          weather={weather}
          i18n={i18n}
          showToast={showToast}
        />

        <AccountModal
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          showToast={showToast}
          onAuthSuccess={handleAuthSuccess}
          currentUser={authenticatedUser}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          showToast={showToast}
          currentLoc={currentLoc}
          authenticatedUser={authenticatedUser}
        />

        {/* Floating Toast */}
        <Toast message={toastMsg} />
      </div>
    </ErrorBoundary>
  );
}
