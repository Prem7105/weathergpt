'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { t } from '@/i18n';
import { useWGPT } from '@/components/wgpt/WeatherGPTProvider';

const RiskMap = dynamic(() => import('@/app/risk/risk-map'), {
  ssr: false,
  loading: () => <div className="glass rounded-2xl h-[580px] animate-pulse" />,
});

export default function HeatmapPage() {
  const { language, location, role, setLocation } = useWGPT();

  // Old /risk?lat=..&lon=.. links land here; adopt that location for the whole app.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (params.get('lat') && params.get('lon') && Number.isFinite(lat) && Number.isFinite(lon)) {
      const name = params.get('name') || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      setLocation({ latitude: lat, longitude: lon, city: name, displayPrimary: name, isGps: false });
      window.history.replaceState(null, '', '/heatmap');
    }
  }, [setLocation]);

  const initialLocation = useMemo(
    () => ({ lat: Number(location.latitude), lon: Number(location.longitude), name: location.displayPrimary || location.city }),
    [location.latitude, location.longitude, location.displayPrimary, location.city]
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h2 className="text-lg font-semibold mb-4">{t(language, 'heatmap_title')}</h2>
      <RiskMap initialLocation={initialLocation} initialPersona={role} />
    </div>
  );
}
