'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Wheat, Fish, Siren, User, Truck, HardHat, Landmark, MapPin, Loader2, Search } from 'lucide-react';
import { searchLocationAutocomplete } from '@/lib/geocoding';
import { LANGUAGE_LABELS, t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';

export const ROLES = [
  { id: 'farmer', icon: Wheat, key: 'role_farmer' },
  { id: 'fisherman', icon: Fish, key: 'role_fisherman' },
  { id: 'disaster', icon: Siren, key: 'role_disaster' },
  { id: 'citizen', icon: User, key: 'role_citizen' },
  { id: 'logistics', icon: Truck, key: 'role_logistics' },
  { id: 'construction', icon: HardHat, key: 'role_construction' },
  { id: 'authority', icon: Landmark, key: 'role_authority' },
];

export function RoleSelector() {
  const { role, setRole, language } = useWGPT();
  return (
    <div className="grid grid-cols-3 gap-3">
      {ROLES.map(({ id, icon: Icon, key }) => (
        <motion.button
          key={id}
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setRole(id)}
          className={`glass rounded-xl p-4 flex flex-col items-center gap-2 transition-colors ${
            role === id ? 'border-brand-to shadow-glow text-brand-to' : 'text-gray-300'
          }`}
        >
          <Icon size={22} />
          <span className="text-xs font-medium text-center">{t(language, key)}</span>
        </motion.button>
      ))}
    </div>
  );
}

export function LanguageSelector({ compact = false }) {
  const { language, setLanguage } = useWGPT();
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      className={`glass rounded-lg text-sm bg-transparent border border-white/10 px-3 py-2 text-gray-100 ${compact ? 'w-28' : 'w-full'}`}
    >
      {Object.keys(LANGUAGE_LABELS).map((code) => (
        <option key={code} value={code} className="bg-surface-card text-white">{LANGUAGE_LABELS[code]}</option>
      ))}
    </select>
  );
}

export function LocationPicker() {
  const { location, language, selectPlace, searchCity, searchHistory, detectLocation, gpsState, isDetectingLoc } = useWGPT();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [active, setActive] = useState(-1);
  const abortRef = useRef(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return undefined;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setNoResults(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const results = await searchLocationAutocomplete(q, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setNoResults(results.length === 0);
        setActive(results.length ? 0 : -1);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(place) {
    selectPlace(place, query);
    skipNextRef.current = true;
    setQuery('');
    setSuggestions([]);
    setNoResults(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[active]) choose(suggestions[active]);
      else if (query.trim()) { searchCity(query); setQuery(''); }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-300 flex items-center gap-2 min-w-0">
          <MapPin size={16} className="text-brand-to shrink-0" />
          <span className="truncate">{location.displayPrimary || location.city}</span>
          <span className="text-gray-500 shrink-0">({Number(location.latitude).toFixed(3)}, {Number(location.longitude).toFixed(3)})</span>
        </div>
        <button
          type="button"
          onClick={detectLocation}
          disabled={isDetectingLoc}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isDetectingLoc && <Loader2 size={12} className="animate-spin" />}
          {isDetectingLoc ? t(language, 'detecting') : t(language, 'use_gps')}
        </button>
      </div>
      {gpsState === 'denied' && <p className="text-xs text-red-400">{t(language, 'location_blocked')}</p>}
      {gpsState === 'error' && <p className="text-xs text-red-400">{t(language, 'location_error')}</p>}

      <div className="relative">
        <Search size={14} className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(language, 'search_city')}
          aria-label={t(language, 'search_city')}
          className="w-full glass rounded-lg bg-transparent pl-9 pr-9 py-2 text-sm text-gray-100 outline-none focus:border-brand-to placeholder:text-gray-500"
        />
        {searching && <Loader2 size={14} className="absolute z-10 right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-to" />}
        {(suggestions.length > 0 || noResults) && (
          <div className="absolute z-[1200] left-0 right-0 mt-2 rounded-xl border border-white/10 bg-surface-card/95 backdrop-blur-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            {noResults && <div className="px-3 py-2.5 text-xs text-gray-500">{t(language, 'no_location_results')}</div>}
            {suggestions.map((s, i) => (
              <button
                key={`${s.placeId || s.name}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 text-sm ${i === active ? 'bg-brand-from/20' : 'hover:bg-white/5'}`}
              >
                <MapPin size={14} className="text-brand-to mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium text-gray-100 truncate">{s.name || s.city}</span>
                  <span className="block text-xs text-gray-500 truncate">{[s.district || s.city, s.state, s.country].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {searchHistory.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-1">{t(language, 'recent_cities')}</span>
          {searchHistory.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => searchCity(city)}
              className="glass rounded-full px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:border-brand-to/50 transition-colors"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
