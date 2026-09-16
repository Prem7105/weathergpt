'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchGoogleCurrentWeather,
  fetchGoogleHourlyForecast,
  fetchGoogleDailyForecast,
  fetchGoogleWeatherAlerts,
  fetchOpenMeteoData,
  normalizeGoogleWeather,
  normalizeGoogleHourly,
  normalizeGoogleDaily,
  normalizeOpenMeteoWeather,
  normalizeOpenMeteoHourly,
  normalizeOpenMeteoDaily,
  logWeatherCoordinates
} from '@/lib/weatherApi';

export function useWeather(showToast) {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState({ hourly: [], daily: [] });
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(600); // 10 mins
  const latestRequestRef = useRef(0);

  const fetchWeatherData = useCallback(async (lat, lng, cityName) => {
    const requestId = ++latestRequestRef.current;
    logWeatherCoordinates(lat, lng);
    setIsLoadingWeather(true);
    setIsFallbackMode(false);

    let curWeather = null;
    let hourlyList = [];
    let dailyList = [];
    let alertsList = [];

    // 1. Try Google Weather API
    try {
      const [curRes, hourlyRes, dailyRes, alertsRes] = await Promise.all([
        fetchGoogleCurrentWeather(lat, lng),
        fetchGoogleHourlyForecast(lat, lng),
        fetchGoogleDailyForecast(lat, lng),
        fetchGoogleWeatherAlerts(lat, lng)
      ]);

      curWeather = normalizeGoogleWeather(curRes, cityName, alertsRes);
      hourlyList = normalizeGoogleHourly(hourlyRes);
      dailyList = normalizeGoogleDaily(dailyRes);
      alertsList = alertsRes;
    } catch (googleErr) {
      console.warn('Google Weather API issue; activating Open-Meteo fallback:', googleErr);
      try {
        const meteoData = await fetchOpenMeteoData(lat, lng);
        curWeather = normalizeOpenMeteoWeather(meteoData, cityName);
        hourlyList = normalizeOpenMeteoHourly(meteoData);
        dailyList = normalizeOpenMeteoDaily(meteoData);
        setIsFallbackMode(true);
      } catch (meteoErr) {
        console.error('All weather providers failed:', meteoErr);
        if (requestId === latestRequestRef.current) {
          if (showToast) {
            showToast('⚠️ Unable to connect to weather satellites. Using cached view.');
          }
          setIsLoadingWeather(false);
        }
        return;
      }
    }

    // A newer fetchWeatherData call started while this one was in flight
    // (e.g. the user searched a second city before this one resolved) —
    // discard this stale response instead of overwriting the current view.
    if (requestId !== latestRequestRef.current) return;

    if (curWeather) {
      curWeather.alerts = alertsList;
      setWeather(curWeather);
      setForecast({ hourly: hourlyList, daily: dailyList });
      setWeatherAlerts(alertsList);
      setLastUpdatedTime(new Date());
      setRefreshCountdown(600);
    }
    setIsLoadingWeather(false);
  }, [showToast]);

  return {
    weather,
    forecast,
    weatherAlerts,
    isFallbackMode,
    isLoadingWeather,
    lastUpdatedTime,
    refreshCountdown,
    setRefreshCountdown,
    fetchWeatherData
  };
}
