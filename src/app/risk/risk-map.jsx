'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import styles from './risk.module.css';
import WeatherBackdrop from '@/components/UI/WeatherBackdrop';

const DEFAULT_LOCATION = { lat: 19.076, lon: 72.8777, name: 'Mumbai, Maharashtra' };

const AVAILABLE_LAYERS = [
  { id: 'precipitation', label: 'Live precipitation', detail: 'OpenWeather precipitation tile overlay' },
  { id: 'risk', label: 'Forecast risk samples', detail: 'Transparent flood, heat, and wind weather signals' },
];
const UNAVAILABLE_LAYERS = ['Cyclone', 'Drought', 'AQI'];

const HAZARDS = [
  { id: 'flood', label: 'Rain / Flood' },
  { id: 'heat', label: 'Heatwave' },
  { id: 'wind', label: 'Strong Wind' },
  { id: 'storm', label: 'Storm Signal' },
];

const PERSONAS = [
  { id: 'citizen', label: 'Citizen' },
  { id: 'farmer', label: 'Farmer' },
  { id: 'logistics', label: 'Logistics / Fleet' },
  { id: 'construction', label: 'Construction' },
  { id: 'authority', label: 'Disaster / Authority' },
  { id: 'fisherman', label: 'Fisherman' },
];

function Recenter({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 10, { duration: 0.7 });
  }, [lat, lon, map]);
  return null;
}

/**
 * Professional Continuous Meteorological Heatmap Engine
 * Uses Inverse Distance Weighting (IDW) + 6-stop LUT color mapping
 * on a low-latency HTML5 Canvas overlay with soft spatial blur.
 */
function ContinuousMeteorologicalHeatmap({ points, hazard }) {
  const map = useMap();
  const canvasRef = useRef(null);

  // Pre-generate a 256-color Lookup Table (LUT) for 60fps rendering
  const colorLUT = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 0);

    // 6-Stop Professional Meteorological Palette
    grad.addColorStop(0.00, 'rgba(30, 136, 229, 0.00)');  // 0.00: Soft Transparent Blue
    grad.addColorStop(0.12, 'rgba(0, 188, 212, 0.38)');   // 0.12: Cyan / Low Risk
    grad.addColorStop(0.32, 'rgba(76, 175, 80, 0.62)');   // 0.32: Emerald Green / Moderate
    grad.addColorStop(0.55, 'rgba(255, 235, 59, 0.78)');  // 0.55: Yellow-Amber / Elevated
    grad.addColorStop(0.75, 'rgba(255, 152, 0, 0.88)');   // 0.75: Vivid Orange / High
    grad.addColorStop(0.88, 'rgba(244, 67, 54, 0.94)');   // 0.88: Crimson Red / Severe
    grad.addColorStop(1.00, 'rgba(183, 28, 28, 0.98)');   // 1.00: Deep Dark Red / Extreme

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);
    return ctx.getImageData(0, 0, 256, 1).data;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return undefined;

    const ctx = canvas.getContext('2d');

    const renderSurface = () => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;

      // Downsample grid (stride = 4px) for high performance rendering
      const scale = 4;
      const width = Math.ceil(size.x / scale);
      const height = Math.ceil(size.y / scale);

      canvas.width = size.x;
      canvas.height = size.y;

      if (!points || points.length === 0) {
        ctx.clearRect(0, 0, size.x, size.y);
        return;
      }

      // Convert Lat/Lon to pixel coordinates relative to viewport
      const pixelPoints = points.map((p) => {
        const pt = map.latLngToContainerPoint([p.lat, p.lon]);
        const score = Number(p.score ?? p.value ?? p.riskValue ?? 0);
        return { x: pt.x / scale, y: pt.y / scale, score };
      });

      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext('2d');
      const imgData = offCtx.createImageData(width, height);
      const data = imgData.data;

      const pExponent = 1.6;
      const radiusSq = Math.pow(140 / scale, 2);

      // Compute Inverse Distance Weighting (IDW) field across downsampled canvas grid
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let num = 0;
          let den = 0;

          for (let i = 0; i < pixelPoints.length; i++) {
            const pt = pixelPoints[i];
            const dx = x - pt.x;
            const dy = y - pt.y;
            const dSq = dx * dx + dy * dy;

            if (dSq < radiusSq * 4) {
              const weight = 1 / (Math.pow(dSq + 12, pExponent));
              num += pt.score * weight;
              den += weight;
            }
          }

          if (den > 0) {
            const interpolatedScore = Math.max(0, Math.min(1, num / den));
            const lutIndex = Math.min(255, Math.floor(interpolatedScore * 255)) * 4;
            const pixelIdx = (y * width + x) * 4;

            data[pixelIdx]     = colorLUT[lutIndex];      // R
            data[pixelIdx + 1] = colorLUT[lutIndex + 1];  // G
            data[pixelIdx + 2] = colorLUT[lutIndex + 2];  // B
            data[pixelIdx + 3] = colorLUT[lutIndex + 3];  // A
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);

      // Render offscreen canvas to main layer with soft spatial blur filter
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.save();
      ctx.filter = 'blur(14px)';
      ctx.globalAlpha = 0.68;
      ctx.drawImage(offscreen, 0, 0, size.x, size.y);
      ctx.restore();
    };

    const animFrame = window.requestAnimationFrame(renderSurface);
    map.on('move zoom resize', renderSurface);

    return () => {
      window.cancelAnimationFrame(animFrame);
      map.off('move zoom resize', renderSurface);
    };
  }, [map, points, hazard, colorLUT]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.heatmapCanvas}
      style={{ pointerEvents: 'none', zIndex: 450 }}
      aria-label={`Continuous ${hazard} weather heatmap`}
    />
  );
}

function MapInspectorHandler({ points, summary, onSelectLocation }) {
  useMapEvents({
    click: ({ latlng }) => {
      const lat = Number(latlng.lat.toFixed(4));
      const lon = Number(latlng.lng.toFixed(4));

      let score = summary?.score ?? summary?.riskValue ?? 0.2;
      let level = summary?.level || 'low';

      if (points && points.length > 0) {
        let num = 0, den = 0;
        for (const p of points) {
          const dist = Math.hypot(p.lat - lat, p.lon - lon);
          const w = 1 / (dist + 0.05);
          num += (p.score ?? p.value ?? 0) * w;
          den += w;
        }
        if (den > 0) {
          score = Number((num / den).toFixed(3));
          if (score >= 0.75) level = 'severe';
          else if (score >= 0.50) level = 'high';
          else if (score >= 0.25) level = 'moderate';
          else level = 'low';
        }
      }

      onSelectLocation({
        name: `Location (${lat}, ${lon})`,
        lat,
        lon,
        score,
        level,
        drivers: summary?.factors || [
          { label: 'Spatial Risk Field', value: `${Math.round(score * 100)}%` },
          { label: 'Surface Pressure / Saturation', value: 'Live Telemetry' }
        ],
        impacts: summary?.impactDecision?.impacts || ['Localized physical weather disruptions possible.'],
        recommendation: summary?.impactDecision?.decision?.recommendations?.[0] || 'Monitor live weather telemetry and official safety bulletins.'
      });
    }
  });
  return null;
}

const INCIDENT_VERIFICATION_COLORS = {
  OFFICIAL: '#b71c1c',
  CORROBORATED: '#e65100',
  REPORTED: '#f57f17',
  COMMUNITY_REPORT: '#757575',
};

function IncidentMarkers({ incidents }) {
  if (!incidents?.length) return null;
  return incidents.map((incident) => (
    <CircleMarker
      key={incident._id || `${incident.category}-${incident.distanceKm}`}
      center={[incident.location.latitude, incident.location.longitude]}
      radius={7}
      pathOptions={{ color: INCIDENT_VERIFICATION_COLORS[incident.verification] || '#757575', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
      pane="markerPane"
    >
      <Tooltip direction="top" opacity={1}>
        <strong>{incident.category.replace('_', ' ').toLowerCase()}</strong>
        <br />{incident.verification.toLowerCase()} · {incident.distanceKm} km away
        <br />{incident.location.name} · {new Date(incident.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Tooltip>
    </CircleMarker>
  ));
}

function priorityFor(level) {
  if (level === 'severe') return 'Critical';
  if (level === 'high') return 'High';
  if (level === 'moderate') return 'Moderate';
  return 'Low';
}

function levelBadgeColor(level) {
  if (level === 'severe') return '#d32f2f';
  if (level === 'high') return '#f57c00';
  if (level === 'moderate') return '#fbc02d';
  return '#2e7d32';
}

// /api/risk returns raw readings rather than condition text, so map them onto the
// vocabulary WeatherBackdrop understands.
function skyCondition(w) {
  if (!w) return 'partly cloudy';
  if (Number(w.precipitation) >= 0.5) return Number(w.windSpeed) >= 50 ? 'thunderstorm' : 'rain';
  if (Number(w.cloudCover) >= 85) return 'overcast';
  if (Number(w.cloudCover) >= 35) return 'partly cloudy';
  return 'clear';
}

function isDaytimeAt(localIsoTime) {
  const hour = Number(String(localIsoTime || '').slice(11, 13));
  return !Number.isFinite(hour) || !localIsoTime ? true : hour >= 6 && hour < 18;
}

function initialLocation() {
  if (typeof window === 'undefined') return DEFAULT_LOCATION;
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!params.get('lat') || !params.get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) return DEFAULT_LOCATION;
  return { lat, lon, name: params.get('name') || `${lat.toFixed(3)}, ${lon.toFixed(3)}` };
}

export default function RiskMap() {
  const [location, setLocation] = useState(initialLocation);
  const [summary, setSummary] = useState(null);
  const [ml, setMl] = useState(null);
  const [grid, setGrid] = useState([]);
  const [status, setStatus] = useState('Loading live Open-Meteo weather signals...');
  const [gpsError, setGpsError] = useState('');
  const [selectedHazard, setSelectedHazard] = useState('flood');
  const [selectedPersona, setSelectedPersona] = useState('citizen');
  const [selectedTime, setSelectedTime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dataStatus, setDataStatus] = useState('LIVE');
  const [groundReality, setGroundReality] = useState(null);
  const [inspectedLocation, setInspectedLocation] = useState(null);
  const [liveWeather, setLiveWeather] = useState(null);

  const loadRisk = useCallback(async (nextLocation) => {
    setStatus('Loading live Open-Meteo weather signals...');
    try {
      const params = new URLSearchParams({ lat: nextLocation.lat, lon: nextLocation.lon, hazard: selectedHazard, persona: selectedPersona });
      if (selectedTime) params.set('time', selectedTime);

      const summaryResponse = await fetch(`/api/risk?${params}`);
      if (!summaryResponse.ok) throw new Error('Risk service unavailable');
      const summaryData = await summaryResponse.json();

      // /api/risk already runs the ML model server-side; /api/ml_precipitation only
      // exists as a Vercel Python function, so it's just a fallback.
      const mlData = selectedHazard !== 'flood'
        ? { enabled: false, reason: 'ML precipitation forecast is available only for rain-derived assessment.' }
        : summaryData.ml?.enabled
          ? summaryData.ml
          : await fetch(`/api/ml_precipitation?${new URLSearchParams({ lat: nextLocation.lat, lon: nextLocation.lon })}`)
            .then((response) => response.ok ? response.json() : (summaryData.ml || { enabled: false, reason: 'ML inference is temporarily unavailable.' }))
            .catch(() => summaryData.ml || { enabled: false, reason: 'ML inference is temporarily unavailable.' });

      setSummary(summaryData.risk);
      setMl(mlData);
      setGrid(summaryData.heatmap?.points || []);
      setGroundReality(summaryData.incidents || null);
      setLiveWeather(summaryData.weatherProvider || null);
      setDataStatus(summaryData.dataStatus || 'LIVE');
      setStatus(`Live data from ${summaryData.source} · updated ${new Date(summaryData.risk?.assessedAt || Date.now()).toLocaleTimeString()}`);
    } catch {
      setSummary(null);
      setMl(null);
      setGrid([]);
      setGroundReality(null);
      setDataStatus('DEGRADED');
      setStatus('Live risk data is temporarily unavailable. No fallback estimates are shown.');
    }
  }, [selectedHazard, selectedPersona, selectedTime]);

  useEffect(() => {
    void loadRisk(location);
    const refreshTimer = window.setInterval(() => void loadRisk(location), 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [location, loadRisk]);

  // Timeline Animation Loop (Play / Pause)
  useEffect(() => {
    if (!isPlaying) return undefined;
    const timeline = summary?.timeline || [];
    if (!timeline.length) return undefined;

    const timer = setInterval(() => {
      setSelectedTime((curr) => {
        const idx = timeline.findIndex((t) => t.time === curr);
        const nextIdx = idx >= 0 && idx < timeline.length - 1 ? idx + 1 : 0;
        return timeline[nextIdx].time;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [isPlaying, summary?.timeline]);

  const useGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Location is unavailable in this browser.');
      return;
    }
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ lat: Number(coords.latitude.toFixed(4)), lon: Number(coords.longitude.toFixed(4)), name: 'Current GPS Location' }),
      () => setGpsError('Location permission was not granted.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const areaOverview = summary;
  const analytics = useMemo(() => {
    const points = summary?.timeline || [];
    if (!points.length) return null;
    const scores = points.map((p) => Number(p.score || 0));
    const peak = points.reduce((best, p) => p.score > best.score ? p : best, points[0]);
    return {
      current: points[0],
      average: scores.reduce((total, s) => total + s, 0) / scores.length,
      maximum: Math.max(...scores),
      minimum: Math.min(...scores),
      peak,
      duration: points.filter((p) => p.score >= 0.25).length,
      points
    };
  }, [summary]);

  const downloadReport = () => {
    if (!areaOverview) return;
    const decision = areaOverview.impactDecision?.decision;
    const report = [
      'WEATHERGPT WEATHER RISK REPORT',
      '',
      `Location: ${location.name}`,
      `Coordinates: ${location.lat}, ${location.lon}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'CURRENT WEATHER',
      `Temperature: ${areaOverview.raw?.temperature ?? 'N/A'} °C`,
      `Feels like: ${areaOverview.raw?.apparentTemperature ?? 'N/A'} °C`,
      `Precipitation: ${areaOverview.raw?.precipitation ?? 'N/A'} mm`,
      `Precipitation probability: ${areaOverview.raw?.precipitationProbability ?? 'N/A'}%`,
      `Wind: ${areaOverview.raw?.windSpeed ?? 'N/A'} km/h`,
      '',
      'RISK ASSESSMENT',
      `Hazard: ${areaOverview.type || areaOverview.hazard}`,
      `Score: ${Math.round(areaOverview.score * 100)}%`,
      `Severity: ${areaOverview.level}`,
      `Peak: ${areaOverview.peakRisk?.time || 'N/A'}`,
      `Drivers: ${(areaOverview.factors || []).map((f) => `${f.label}: ${f.value}`).join('; ') || 'N/A'}`,
      '',
      'IMPACT',
      ...(areaOverview.impactDecision?.impacts || ['N/A']),
      '',
      'DECISION',
      `Priority: ${decision?.priority || 'N/A'}`,
      `Recommendations: ${(decision?.recommendations || []).join(' ') || 'N/A'}`,
      `Avoid: ${(decision?.avoid || []).join(' ') || 'N/A'}`,
      `Monitor: ${(decision?.monitor || []).join(' ') || 'N/A'}`,
      `Escalation: ${decision?.escalation || 'N/A'}`,
      '',
      'DATA TRANSPARENCY',
      'Source: Open-Meteo',
      `Assessed: ${areaOverview.assessedAt || new Date().toISOString()}`,
      `Status: ${dataStatus}`,
      'Method: Continuous spatial meteorological field assessment'
    ].join('\n');

    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `weatherGPT-risk-report-${location.lat}-${location.lon}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const timelineList = summary?.timeline || [];

  return (
    <section className={styles.content}>
      <WeatherBackdrop condition={skyCondition(liveWeather)} isDaytime={isDaytimeAt(liveWeather?.time)} />
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div>
          <p className={styles.location}>{location.name}</p>
          <p className={styles.coordinates}>{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>
        </div>
        <div className={styles.toolbarActions}>
          <select className={styles.hazardSelect} value={selectedHazard} onChange={(e) => setSelectedHazard(e.target.value)} aria-label="Risk hazard">
            {HAZARDS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
          <select className={styles.hazardSelect} value={selectedPersona} onChange={(e) => setSelectedPersona(e.target.value)} aria-label="Impact persona">
            {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="button" className={styles.primaryButton} onClick={useGps}>Use my GPS location</button>
          <button type="button" className={styles.secondaryButton} onClick={downloadReport} disabled={!areaOverview}>Generate report</button>
        </div>
      </div>
      {gpsError && <p className={styles.error}>{gpsError}</p>}

      {/* Main Leaflet Map Shell */}
      <div className={styles.layout}>
        <div className={styles.mapShell}>
          {/* Status Badge Overlay */}
          <div className={styles.dataStatusBadge}>
            <span className={dataStatus === 'DEMO-SCENARIO' ? styles.statusDemoDot : dataStatus === 'OFFLINE-CACHED' ? styles.statusOfflineDot : styles.statusLiveDot} />
            <span>{dataStatus === 'LIVE' ? 'LIVE · Open-Meteo' : dataStatus.replaceAll('-', ' ')}</span>
          </div>

          <MapContainer center={[location.lat, location.lon]} zoom={10} className={styles.map} scrollWheelZoom={false}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
              maxZoom={16}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              url="/api/risk/tiles/{z}/{x}/{y}"
              attribution="Weather layer &copy; OpenWeather"
              opacity={0.62}
              maxZoom={18}
            />
            <Recenter lat={location.lat} lon={location.lon} />

            {/* Continuous Meteorological Heatmap Surface */}
            <ContinuousMeteorologicalHeatmap points={grid} hazard={selectedHazard} />

            {/* Map Inspector Handler */}
            <MapInspectorHandler points={grid} summary={summary} onSelectLocation={setInspectedLocation} />

            {/* Ground Reality Incident Markers */}
            <IncidentMarkers incidents={groundReality?.incidents || []} />

            {/* Target Location Marker */}
            <CircleMarker
              center={[location.lat, location.lon]}
              radius={8}
              pathOptions={{ color: '#1565c0', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}
            >
              <Tooltip permanent>{location.name}</Tooltip>
            </CircleMarker>
          </MapContainer>

          {/* Interactive Location Inspector Card Overlay */}
          {inspectedLocation && (
            <div className={styles.inspectorOverlay}>
              <div className={styles.inspectorHeader}>
                <div>
                  <h3 className={styles.inspectorTitle}>{inspectedLocation.name}</h3>
                  <small className={styles.coordinates}>{inspectedLocation.lat}, {inspectedLocation.lon}</small>
                </div>
                <button type="button" className={styles.inspectorClose} onClick={() => setInspectedLocation(null)}>✕</button>
              </div>

              <div
                className={styles.inspectorScoreBadge}
                style={{
                  background: `${levelBadgeColor(inspectedLocation.level)}15`,
                  color: levelBadgeColor(inspectedLocation.level),
                  border: `1px solid ${levelBadgeColor(inspectedLocation.level)}40`
                }}
              >
                <span>{selectedHazard.toUpperCase()} RISK:</span>
                <strong>{Math.round(inspectedLocation.score * 100)}% ({inspectedLocation.level.toUpperCase()})</strong>
              </div>

              {inspectedLocation.drivers && inspectedLocation.drivers.length > 0 && (
                <div className={styles.inspectorDrivers}>
                  <strong>Primary Drivers:</strong>
                  <div>• {inspectedLocation.drivers.map((d) => `${d.label}: ${d.value}`).join(' · ')}</div>
                </div>
              )}

              {inspectedLocation.recommendation && (
                <div className={styles.inspectorAction}>
                  👉 <strong>{selectedPersona.toUpperCase()} DIRECTIVE:</strong> {inspectedLocation.recommendation}
                </div>
              )}
            </div>
          )}

          {/* 6-Stop Continuous Meteorological Color Legend */}
          <div className={styles.continuousLegend} aria-label="Risk heatmap legend">
            <div className={styles.legendTitle}>
              <span>Continuous Risk Field</span>
              <span>0.00 – 1.00</span>
            </div>
            <div className={styles.legendGradientBar} />
            <div className={styles.legendLabels}>
              <span>LOW (0.0)</span>
              <span>MOD (0.3)</span>
              <span>HIGH (0.6)</span>
              <span>EXTREME (1.0)</span>
            </div>
          </div>

          {/* Forecast Timeline Scrubber & Animation Control */}
          {timelineList.length > 0 && (
            <div className={styles.mapTimelineBar} aria-label="Forecast timeline scrubber">
              <button
                type="button"
                className={styles.playBtn}
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pause forecast animation' : 'Play 24h forecast animation'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>

              <div className={styles.timelineScrubber}>
                <button
                  type="button"
                  className={`${styles.timelineChip} ${!selectedTime ? styles.timelineChipActive : ''}`}
                  onClick={() => setSelectedTime(null)}
                >
                  NOW
                </button>
                {timelineList.slice(0, 6).map((step) => {
                  const label = new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isActive = selectedTime === step.time;
                  return (
                    <button
                      key={step.time}
                      type="button"
                      className={`${styles.timelineChip} ${isActive ? styles.timelineChipActive : ''}`}
                      onClick={() => setSelectedTime(step.time)}
                    >
                      {label} ({Math.round(step.score * 100)}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Floating Hazard Selection Bar */}
          <div className={styles.hazardControl} aria-label="Risk map hazard layers">
            {HAZARDS.map((h) => (
              <button
                key={h.id}
                type="button"
                className={selectedHazard === h.id ? styles.hazardActive : ''}
                onClick={() => setSelectedHazard(h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Information Panels */}
        <section className={styles.infoGrid}>
          {areaOverview ? (
            <>
              <article className={styles.infoCard}>
                <h2>Area risk overview</h2>
                <p className={styles.coordinates}>{location.name} · live weather-derived assessment</p>
                <div className={`${styles.level} ${styles[areaOverview.level]}`}>
                  <strong>{Math.round(areaOverview.score * 100)}%</strong>
                  <span>{priorityFor(areaOverview.level)} · {areaOverview.type || areaOverview.hazard} risk</span>
                </div>
                <p className={styles.method}>
                  Source: Open-Meteo · Method: Continuous spatial meteorological field assessment.
                </p>
              </article>

              <article className={styles.infoCard}>
                <h2>Key weather details</h2>
                {areaOverview.raw ? (
                  <ul className={styles.detailRows}>
                    <li><span>Precipitation</span><b>{areaOverview.raw.precipitation} mm</b></li>
                    <li><span>Precipitation probability</span><b>{areaOverview.raw.precipitationProbability}%</b></li>
                    <li><span>Temperature</span><b>{areaOverview.raw.temperature} °C</b></li>
                    <li><span>Feels like</span><b>{areaOverview.raw.apparentTemperature} °C</b></li>
                    <li><span>Wind speed</span><b>{areaOverview.raw.windSpeed} km/h</b></li>
                  </ul>
                ) : (
                  <p className={styles.empty}>Live weather details unavailable.</p>
                )}
              </article>

              <article className={styles.infoCard}>
                <h2>Why this score?</h2>
                <ul className={styles.factors}>
                  {(areaOverview.factors || []).map((factor) => (
                    <li key={factor.label}>
                      <span>{factor.label}</span>
                      <b>{factor.value}</b>
                    </li>
                  ))}
                </ul>
              </article>

              <article className={styles.infoCard}>
                <h2>Ground reality</h2>
                {groundReality?.incidents?.length ? (
                  <>
                    <p className={styles.method}>
                      Reported disruptions within range, assessed at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                    </p>
                    <ul className={styles.incidentList}>
                      {groundReality.incidents.map((incident) => (
                        <li key={incident._id || `${incident.category}-${incident.distanceKm}`}>
                          <b>{incident.category.replace('_', ' ').toLowerCase()}</b>
                          <span>{incident.verification.toLowerCase()} · {incident.distanceKm} km · {incident.location.name}</span>
                          <small>{incident.source}</small>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className={styles.method}>
                    No reported incidents in the current range and window. This remains a weather-derived assessment only.
                  </p>
                )}
              </article>

              {areaOverview.impactDecision && (
                <>
                  <article className={styles.infoCard}>
                    <h2>Potential impact</h2>
                    <ul className={styles.factors}>
                      {areaOverview.impactDecision.impacts.map((imp) => (
                        <li key={imp}><span>{imp}</span></li>
                      ))}
                    </ul>
                  </article>

                  <article className={styles.infoCard}>
                    <h2>What should you do?</h2>
                    <p className={styles.method}><b>Priority:</b> {priorityFor(areaOverview.level)} · {areaOverview.impactDecision.decision.priority}</p>
                    <ul className={styles.factors}>
                      {areaOverview.impactDecision.decision.recommendations.map((action) => (
                        <li key={action}><span>{action}</span></li>
                      ))}
                    </ul>
                  </article>
                </>
              )}
            </>
          ) : (
            <p className={styles.empty}>Risk summary will appear when live weather data is available.</p>
          )}

          <p className={styles.status}>{status}</p>

          <div className={styles.layersSection}>
            <h3>Map layers</h3>
            {AVAILABLE_LAYERS.map((layer) => (
              <div className={styles.layerActive} key={layer.id}>
                <b>{layer.label}</b>
                <small>{layer.detail}</small>
              </div>
            ))}
            {UNAVAILABLE_LAYERS.map((layer) => (
              <div className={styles.layerUnavailable} key={layer}>
                {layer}
                <small>Requires a verified live source</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ML Section */}
      <section className={styles.mlSection} aria-label="ML precipitation forecast">
        <div>
          <p className={styles.eyebrow}>ML precipitation forecast</p>
          <h2>Next-hour rainfall signal</h2>
        </div>
        {ml?.enabled ? (
          <>
            <strong className={styles.mlValue}>{ml.predictedPrecipitationMm} mm</strong>
            <p className={styles.method}>
              Predicted precipitation for the next hour from live Open-Meteo inputs.
            </p>
            <div className={styles.mlMeta}>
              <span>Model: {ml.algorithm || ml.model}</span>
              <span>Input: {ml.inputTimestamp || 'N/A'}</span>
              <span>Source: {ml.source || 'Open-Meteo'}</span>
            </div>
          </>
        ) : (
          <p className={styles.empty}>{ml?.reason || 'ML precipitation forecast is unavailable for this hazard.'}</p>
        )}
      </section>

      {/* Risk Analytics Section */}
      <section className={styles.analyticsSection}>
        <div>
          <p className={styles.eyebrow}>Risk analytics</p>
          <h2>Forecast risk profile</h2>
        </div>
        {analytics ? (
          <>
            <div className={styles.analyticsMetrics}>
              <div><span>Current</span><b>{Math.round(analytics.current.score * 100)}%</b></div>
              <div><span>Average</span><b>{Math.round(analytics.average * 100)}%</b></div>
              <div><span>Maximum</span><b>{Math.round(analytics.maximum * 100)}%</b></div>
              <div><span>Minimum</span><b>{Math.round(analytics.minimum * 100)}%</b></div>
              <div><span>Peak</span><b>{new Date(analytics.peak.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div>
              <div><span>Elevated periods</span><b>{analytics.duration}</b></div>
            </div>
            <div className={styles.analyticsChart} aria-label="Risk versus time">
              <div className={styles.chartAxis}>
                {analytics.points.map((pt) => (
                  <div key={pt.time} style={{ height: `${Math.max(8, Math.round(pt.score * 100))}%` }} title={`${pt.level} · ${Math.round(pt.score * 100)}%`}>
                    <span />
                  </div>
                ))}
              </div>
              <div className={styles.chartLabels}>
                {analytics.points.map((pt) => (
                  <small key={pt.time}>{new Date(pt.time).toLocaleTimeString([], { hour: 'numeric' })}</small>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className={styles.empty}>Insufficient forecast data for analytics.</p>
        )}
      </section>
    </section>
  );
}
