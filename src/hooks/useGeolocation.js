'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatLocationDisplay, reverseGeocodeCoords } from '@/lib/geocoding';

export function useGeolocation(initialCity = '', initialLat = null, initialLng = null, onLocationDetected) {
  const [currentLoc, setCurrentLoc] = useState({
    latitude: initialLat ?? null,
    longitude: initialLng ?? null,
    accuracy: null,
    address: initialCity || '',
    city: initialCity || '',
    state: '',
    country: '',
    source: initialLat != null && initialLng != null ? 'initial' : 'none',
    isGps: false,
    detail: ''
  });

  const [gpsState, setGpsState] = useState('prompt');
  const [isDetectingLoc, setIsDetectingLoc] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!navigator.geolocation) {
        setGpsState('unsupported');
      }
    }
  }, []);

  const runGpsDetect = useCallback(async (showToast) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsState('unsupported');
      if (showToast) showToast('Location detection is not supported by this browser. You can search for a city manually.');
      return;
    }

    setGpsState('waiting');
    setIsDetectingLoc(true);

    // Chrome only starts getCurrentPosition's own timeout after the permission
    // prompt is answered, so an ignored/dismissed prompt would leave the
    // "Acquiring GPS" overlay up forever. The watchdog guarantees it settles.
    const requestPosition = (highAccuracy, timeoutMs) => new Promise((resolve, reject) => {
      const watchdog = setTimeout(() => reject({ code: 3, message: 'Location request timed out' }), timeoutMs + 5000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(watchdog); resolve(pos); },
        (err) => { clearTimeout(watchdog); reject(err); },
        { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: highAccuracy ? 0 : 300000 }
      );
    });

    try {
      let position;
      try {
        position = await requestPosition(true, 20000);
      } catch (err) {
        if (err.code !== 3) throw err;
        const permission = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
        if (permission?.state === 'prompt') throw err;
        // Desktops without a GPS chip often time out in high-accuracy mode;
        // fall back to network/Wi-Fi positioning.
        position = await requestPosition(false, 15000);
      }

      const { latitude, longitude, accuracy } = position.coords;
      console.log({ latitude, longitude, accuracy });
      const geoInfo = await reverseGeocodeCoords(latitude, longitude);
      const display = formatLocationDisplay(geoInfo);
      const cityName = geoInfo?.city || geoInfo?.locality || display.primary;
      const stateName = geoInfo?.state || geoInfo?.subdivision || '';
      const countryName = geoInfo?.country || '';
      console.log('GPS reverse-geocoding response:', geoInfo);
      console.log('GPS display address:', display);

      const newLoc = {
        ...geoInfo,
        latitude,
        longitude,
        accuracy,
        address: geoInfo?.formatted || geoInfo?.address || display.primary,
        displayPrimary: display.primary,
        displaySecondary: display.secondary,
        city: cityName,
        state: stateName,
        country: countryName,
        source: 'gps',
        isGps: true,
        detail: stateName,
        accuracyQuality: accuracy > 1000 ? 'low' : 'normal'
      };

      setCurrentLoc(newLoc);
      setGpsState('granted');
      setIsDetectingLoc(false);
      onLocationDetected?.(latitude, longitude, cityName);

      if (showToast) {
        showToast(`📍 GPS Detected: ${cityName}${stateName ? ` (${stateName})` : ''}`);
      }
    } catch (err) {
      console.warn('GPS detection failed:', err);
      setGpsState(err.code === 1 ? 'denied' : 'error');
      setIsDetectingLoc(false);

      if (showToast) {
        if (err.code === 1) {
          showToast('Location permission is required to detect your exact location. You can search for a city manually instead.');
        } else if (err.code === 3) {
          showToast('GPS took too long to respond. Please try again or search for a city manually.');
        } else {
          showToast('Your device location is currently unavailable. You can search for a city manually instead.');
        }
      }
    }
  }, [onLocationDetected]);

  const handleSkipGps = useCallback(() => {
    setGpsState('denied');
  }, []);

  return {
    currentLoc,
    setCurrentLoc,
    gpsState,
    setGpsState,
    isDetectingLoc,
    runGpsDetect,
    handleSkipGps
  };
}
