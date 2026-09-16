'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import h337 from 'heatmap.js';
import styles from './risk.module.css';

const DEFAULT_LOCATION = { lat: 19.076, lon: 72.8777, name: 'Mumbai, Maharashtra' };
const AVAILABLE_LAYERS = [
  { id: 'precipitation', label: 'Live precipitation', detail: 'OpenWeather precipitation tile overlay' },
  { id: 'risk', label: 'Forecast risk samples', detail: 'Transparent flood, heat, and wind weather signals' },
];
const UNAVAILABLE_LAYERS = ['Cyclone', 'Drought', 'AQI'];
const HAZARDS = [
  { id: 'flood', label: 'Rain / flood' },
  { id: 'heat', label: 'Heatwave' },
  { id: 'wind', label: 'Strong wind' },
  { id: 'storm', label: 'Storm signal' },
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
  useEffect(() => { map.flyTo([lat, lon], 10, { duration: 0.7 }); }, [lat, lon, map]);
  return null;
}

function LiveHeatmap({ points, hazard, localized }) {
  const map = useMap();
  const containerRef = useRef(null);
  const heatmapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    containerRef.current.replaceChildren();
    // Size the host before heatmap.js creates its canvas. If it starts at 0x0,
    // the canvas stays invisible even though the live point data is valid.
    const initialSize = map.getSize();
    containerRef.current.style.width = `${initialSize.x}px`;
    containerRef.current.style.height = `${initialSize.y}px`;
    heatmapRef.current = h337.create({
      container: containerRef.current,
      radius: localized ? 42 : 190,
      maxOpacity: 0.82,
      minOpacity: 0.22,
      blur: 0.94,
      gradient: { '0': '#2e7d32', '.2': '#2e7d32', '.35': '#f9a825', '.55': '#f57c00', '.78': '#d32f2f', '1': '#7f0000' },
    });

    const redraw = () => {
      const size = map.getSize();
      containerRef.current.style.width = `${size.x}px`;
      containerRef.current.style.height = `${size.y}px`;
      if (heatmapRef.current?._renderer?.setDimensions) {
        heatmapRef.current._renderer.setDimensions(size.x, size.y);
      }
      const selectedValues = points.map((point) => {
        const selected = point.hazards?.find((item) => item.type === hazard) || point;
        return Number(selected.score ?? selected.value ?? 0);
      });
      const minValue = Math.min(...selectedValues, 0);
      const maxValue = Math.max(...selectedValues, 1);
      const range = maxValue - minValue;
      const data = points.map((point, index) => {
        const pixel = map.latLngToContainerPoint([point.lat, point.lon]);
        const raw = selectedValues[index];
        const value = range > 0.001 ? 0.14 + ((raw - minValue) / range) * 0.86 : Math.max(0.14, Math.min(1, raw));
        return { x: Math.round(pixel.x), y: Math.round(pixel.y), value };
      });
      heatmapRef.current?.setData({ max: 1, data });
    };

    // Leaflet can report a zero-sized container during the first effect pass.
    // Paint once after layout has settled so the live point is actually visible.
    const firstFrame = window.requestAnimationFrame(redraw);
    const secondFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(redraw));
    map.on('move zoom resize', redraw);
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); map.off('move zoom resize', redraw); heatmapRef.current = null; };
  }, [map, points, hazard, localized]);

  return <div ref={containerRef} className={styles.heatmapCanvas} aria-label={`Live ${hazard} heatmap`} />;
}

function AreaSelection({ points, summary, onSelect }) {
  useMapEvents({
    click: ({ latlng }) => {
      if (!points.length) return;
      const nearest = points.reduce((best, point) => {
        const distance = Math.hypot(point.lat - latlng.lat, point.lon - latlng.lng);
        return !best || distance < best.distance ? { point, distance } : best;
      }, null);
      if (nearest) onSelect({ ...summary, ...nearest.point, name: `Grid area ${nearest.point.lat.toFixed(3)}, ${nearest.point.lon.toFixed(3)}` });
    },
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

export default function RiskMap() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [summary, setSummary] = useState(null);
  const [ml, setMl] = useState(null);
  const [grid, setGrid] = useState([]);
  const [status, setStatus] = useState('Loading live Open-Meteo weather signals...');
  const [gpsError, setGpsError] = useState('');
  const [selectedHazard, setSelectedHazard] = useState('flood');
  const [selectedPersona, setSelectedPersona] = useState('citizen');
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [spatialStatus, setSpatialStatus] = useState('localized');
  const [spatialMessage, setSpatialMessage] = useState('Regional spatial weather data is unavailable. Showing only the selected coordinate.');
  const [groundReality, setGroundReality] = useState(null);

  const loadRisk = useCallback(async (nextLocation) => {
    setStatus('Loading live Open-Meteo weather signals...');
    try {
      const params = new URLSearchParams({ lat: nextLocation.lat, lon: nextLocation.lon, hazard: selectedHazard, persona: selectedPersona });
      if (selectedTime) params.set('time', selectedTime);
      const summaryResponse = await fetch(`/api/risk?${params}`);
      if (!summaryResponse.ok) throw new Error('Risk service unavailable');
      const summaryData = await summaryResponse.json();
      const mlData = selectedHazard === 'flood'
        ? await fetch(`/api/ml_precipitation?${new URLSearchParams({ lat: nextLocation.lat, lon: nextLocation.lon })}`)
          .then((response) => response.ok ? response.json() : ({ enabled: false, reason: 'ML inference is temporarily unavailable.' }))
          .catch(() => ({ enabled: false, reason: 'ML inference is temporarily unavailable.' }))
        : { enabled: false, reason: 'ML precipitation forecast is available only for rain-derived assessment.' };
      setSummary(summaryData.risk);
      setMl(mlData);
      setGrid(summaryData.heatmap?.points || []);
      setSpatialStatus(summaryData.heatmap?.spatialStatus || 'localized');
      setSpatialMessage(summaryData.heatmap?.spatialMessage || 'Regional spatial weather data is unavailable. Showing only the selected coordinate.');
      setGroundReality(summaryData.incidents || null);
      setSelectedArea(null);
      setStatus(`Live data from ${summaryData.source} · updated ${new Date(summaryData.risk.assessedAt).toLocaleTimeString()}`);
    } catch {
      setSummary(null);
      setMl(null);
      setGrid([]);
      setSpatialStatus('localized');
      setGroundReality(null);
      setStatus('Live risk data is temporarily unavailable. No fallback estimates are shown.');
    }
  }, [selectedHazard, selectedPersona, selectedTime]);

  useEffect(() => {
    void loadRisk(location);
    const refreshTimer = window.setInterval(() => void loadRisk(location), 10 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [location, loadRisk]);

  const useGps = () => {
    if (!navigator.geolocation) { setGpsError('Location is unavailable in this browser.'); return; }
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ lat: Number(coords.latitude.toFixed(4)), lon: Number(coords.longitude.toFixed(4)), name: 'Current GPS location' }),
      () => setGpsError('Location permission was not granted.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const areaOverview = selectedArea || summary;
  const highRiskAreas = [...grid]
    .filter((point) => point.value >= 0.25)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const analytics = useMemo(() => {
    const points = areaOverview?.timeline || summary?.timeline || [];
    if (!points.length) return null;
    const scores = points.map((point) => Number(point.score || 0));
    const peak = points.reduce((best, point) => point.score > best.score ? point : best, points[0]);
    return { current: points[0], average: scores.reduce((total, score) => total + score, 0) / scores.length, maximum: Math.max(...scores), minimum: Math.min(...scores), peak, duration: points.filter((point) => point.score >= 0.25).length, points };
  }, [areaOverview, summary]);

  const downloadReport = () => {
    if (!areaOverview) return;
    const decision = areaOverview.impactDecision?.decision;
    const report = ['WEATHERGPT WEATHER RISK REPORT', '', `Location: ${location.name}`, `Coordinates: ${location.lat}, ${location.lon}`, `Generated: ${new Date().toISOString()}`, '', 'CURRENT WEATHER', `Temperature: ${areaOverview.raw?.temperature ?? 'Data unavailable'} C`, `Feels like: ${areaOverview.raw?.apparentTemperature ?? 'Data unavailable'} C`, `Precipitation: ${areaOverview.raw?.precipitation ?? 'Data unavailable'} mm`, `Precipitation probability: ${areaOverview.raw?.precipitationProbability ?? 'Data unavailable'}%`, `Wind: ${areaOverview.raw?.windSpeed ?? 'Data unavailable'} km/h`, '', 'RISK ASSESSMENT', `Hazard: ${areaOverview.type || areaOverview.hazard}`, `Score: ${Math.round(areaOverview.score * 100)}%`, `Severity: ${areaOverview.level}`, `Peak: ${areaOverview.peakRisk?.time || 'Data unavailable'}`, `Drivers: ${(areaOverview.factors || []).map((factor) => `${factor.label}: ${factor.value}`).join('; ') || 'Data unavailable'}`, '', 'IMPACT', ...(areaOverview.impactDecision?.impacts || ['Data unavailable']), '', 'DECISION', `Priority: ${decision?.priority || 'Data unavailable'}`, `Recommendations: ${(decision?.recommendations || []).join(' ') || 'Data unavailable'}`, `Avoid: ${(decision?.avoid || []).join(' ') || 'Data unavailable'}`, `Monitor: ${(decision?.monitor || []).join(' ') || 'Data unavailable'}`, `Escalation: ${decision?.escalation || 'Data unavailable'}`, '', 'DATA TRANSPARENCY', 'Source: Open-Meteo', `Assessed: ${areaOverview.assessedAt || new Date().toISOString()}`, `Method: ${areaOverview.method || 'Rule-based weather risk assessment'}`, 'Verified guidance: unavailable unless an official source is configured.'].join('\n');
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `weatherGPT-risk-report-${location.lat}-${location.lon}.txt`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className={styles.content}>
      <div className={styles.toolbar}>
        <div><p className={styles.location}>{location.name}</p><p className={styles.coordinates}>{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p></div>
        <div className={styles.toolbarActions}>
          <select className={styles.hazardSelect} value={selectedHazard} onChange={(event) => setSelectedHazard(event.target.value)} aria-label="Risk hazard">
            {HAZARDS.map((hazard) => <option key={hazard.id} value={hazard.id}>{hazard.label}</option>)}
          </select>
          <select className={styles.hazardSelect} value={selectedPersona} onChange={(event) => setSelectedPersona(event.target.value)} aria-label="Impact persona">
            {PERSONAS.map((persona) => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
          </select>
          <button type="button" className={styles.primaryButton} onClick={useGps}>Use my GPS location</button>
          <button type="button" className={styles.secondaryButton} onClick={downloadReport} disabled={!areaOverview}>Generate report</button>
        </div>
      </div>
      {gpsError && <p className={styles.error}>{gpsError}</p>}

      <div className={styles.layout}>
        <div className={styles.mapShell}>
          <MapContainer center={[location.lat, location.lon]} zoom={10} className={styles.map} scrollWheelZoom={false}>
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
              maxZoom={19}
            />
            <TileLayer
              url="/api/risk/tiles/{z}/{x}/{y}"
              attribution="Weather layer &copy; OpenWeather"
              opacity={0.62}
              maxZoom={18}
            />
            <Recenter lat={location.lat} lon={location.lon} />
            <LiveHeatmap points={grid} hazard={selectedHazard} localized={spatialStatus === 'localized'} />
            <AreaSelection points={grid} summary={summary} onSelect={setSelectedArea} />
            <IncidentMarkers incidents={groundReality?.incidents || []} />
            <CircleMarker center={[location.lat, location.lon]} radius={8} pathOptions={{ color: '#1565c0', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}><Tooltip permanent>{location.name}</Tooltip></CircleMarker>
          </MapContainer>
          <div className={styles.mapLegend}><span><i className={styles.low} />Low</span><span><i className={styles.moderate} />Moderate</span><span><i className={styles.high} />High</span><span><i className={styles.severe} />Severe</span><span><i className={styles.incidentOfficial} />Official</span><span><i className={styles.incidentReported} />Reported</span></div>
          <div className={styles.hazardControl} aria-label="Risk map hazard layers">
            {HAZARDS.map((hazard) => <button key={hazard.id} type="button" className={selectedHazard === hazard.id ? styles.hazardActive : ''} onClick={() => setSelectedHazard(hazard.id)}>{hazard.label}</button>)}
          </div>
        </div>

        <section className={styles.infoGrid}>
          {areaOverview ? <>
          <article className={styles.infoCard}>
          <h2>Area risk overview</h2>
            <p className={styles.coordinates}>{selectedArea?.name || location.name} · live weather-derived assessment</p>
            <div className={`${styles.level} ${styles[areaOverview.level]}`}><strong>{Math.round(areaOverview.score * 100)}%</strong><span>{priorityFor(areaOverview.level)} · {areaOverview.type || areaOverview.hazard} risk</span></div>
            <p className={styles.method}>Source: Open-Meteo · Method: rule-based weather-signal assessment. No validated ML model or official warning is implied.</p>
            <h3>High-risk areas</h3>
            {spatialStatus !== 'localized' ? <p className={styles.empty}>{spatialMessage}</p> : (highRiskAreas.length ? <ul className={styles.areaList}>{highRiskAreas.map((area) => <li key={`${area.lat}-${area.lon}`}><button type="button" onClick={() => setSelectedArea({ ...summary, ...area, name: `Grid area ${area.lat.toFixed(3)}, ${area.lon.toFixed(3)}` })}><b>{priorityFor(area.level)} · {area.hazard}</b><span>{Math.round(area.value * 100)}% · {area.lat.toFixed(3)}, {area.lon.toFixed(3)}</span></button></li>)}</ul> : <p className={styles.empty}>No elevated areas in the live forecast grid.</p>)}
            </article>
            <article className={styles.infoCard}><h2>Key weather details</h2>
            {areaOverview.raw ? <ul className={styles.detailRows}><li><span>Precipitation</span><b>{areaOverview.raw.precipitation} mm</b></li><li><span>Precipitation probability</span><b>{areaOverview.raw.precipitationProbability}%</b></li><li><span>Temperature</span><b>{areaOverview.raw.temperature} °C</b></li><li><span>Feels like</span><b>{areaOverview.raw.apparentTemperature} °C</b></li><li><span>Wind speed</span><b>{areaOverview.raw.windSpeed} km/h</b></li></ul> : <p className={styles.empty}>Live weather details unavailable.</p>}
            </article>
            <article className={styles.infoCard}><h2>Risk summary</h2>
            <p className={styles.method}>Live weather-signal assessment. This is an interpretable risk score, not a trained incident model.</p>
            </article>
            <article className={styles.infoCard}><h2>Why this score?</h2>
            <ul className={styles.factors}>{(areaOverview.factors || []).map((factor) => <li key={factor.label}><span>{factor.label}</span><b>{factor.value}</b></li>)}</ul>
            </article>
            <article className={styles.infoCard}><h2>Ground reality</h2>
            {groundReality?.incidents?.length ? <>
              <p className={styles.method}>Reported disruptions within range, assessed at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Verification reflects the original report; these are reported observations, not automatic facts.</p>
              <ul className={styles.incidentList}>{groundReality.incidents.map((incident) => <li key={incident._id || `${incident.category}-${incident.distanceKm}`}><b>{incident.category.replace('_', ' ').toLowerCase()}</b><span>{incident.verification.toLowerCase()} · {incident.distanceKm} km · {incident.location.name}</span><small>{incident.source}</small></li>)}</ul>
              {groundReality.advisory && <p className={styles.method}><b>{selectedPersona.replace('_', ' ')}:</b> {groundReality.advisory.text} {groundReality.advisory.action}</p>}
              {groundReality.advisory?.prediction && <p className={styles.method}>Fused with live {groundReality.advisory.prediction.hazard} risk ({groundReality.advisory.prediction.level}).</p>}
            </> : <p className={styles.method}>No reported incidents in the current range and window. This remains a weather-derived assessment only; official ground guidance may still be unavailable.</p>}
            </article>
            <article className={styles.infoCard}><h2>Risk timeline</h2>
            <div className={styles.timeline}>{(areaOverview.timeline || summary?.timeline || []).map((point) => <button type="button" className={selectedTime === point.time ? styles.timelineActive : ''} key={point.time} onClick={() => setSelectedTime(point.time)}><b>{new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b><small className={styles[point.level]}>{point.level}</small></button>)}</div>
            {(areaOverview.cyclone || summary?.cyclone) && <p className={styles.method}>Cyclone track: {(areaOverview.cyclone || summary.cyclone).message}</p>}
            </article>
            {areaOverview.impactDecision && <>
              <article className={styles.infoCard}><h2>Potential impact</h2>
              <ul className={styles.factors}>{areaOverview.impactDecision.impacts.map((impact) => <li key={impact}><span>{impact}</span></li>)}</ul>
              </article><article className={styles.infoCard}><h2>What should you do?</h2>
              <p className={styles.method}><b>Priority:</b> {priorityFor(areaOverview.level)} · {areaOverview.impactDecision.decision.priority}</p>
              <ul className={styles.factors}>{areaOverview.impactDecision.decision.recommendations.map((action) => <li key={action}><span>{action}</span></li>)}</ul>
              <p className={styles.method}><b>Monitor:</b> {areaOverview.impactDecision.decision.monitor.join(' ')}</p>
              <p className={styles.method}><b>Escalation:</b> {areaOverview.impactDecision.decision.escalation}</p>
              <p className={styles.method}><b>Peak:</b> {areaOverview.peakRisk ? new Date(areaOverview.peakRisk.time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not available'}</p>
              </article><article className={styles.infoCard}><h2>Escalation &amp; monitoring</h2><p className={styles.method}><b>Monitor:</b> {areaOverview.impactDecision.decision.monitor.join(' ')}</p><p className={styles.method}><b>Escalation:</b> {areaOverview.impactDecision.decision.escalation}</p><p className={styles.method}><b>Peak:</b> {areaOverview.peakRisk ? new Date(areaOverview.peakRisk.time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not available'}</p></article>
            </>}
          </> : <p className={styles.empty}>Risk summary will appear when live weather data is available.</p>}
          <p className={styles.status}>{status}</p>
          <div className={styles.layersSection}>
          <h3>Map layers</h3>
          {AVAILABLE_LAYERS.map((layer) => <div className={styles.layerActive} key={layer.id}><b>{layer.label}</b><small>{layer.detail}</small></div>)}
          {UNAVAILABLE_LAYERS.map((layer) => <div className={styles.layerUnavailable} key={layer}>{layer}<small>Requires a verified live source</small></div>)}
          </div>
        </section>
      </div>
      <section className={styles.mlSection} aria-label="ML precipitation forecast">
        <div><p className={styles.eyebrow}>ML precipitation forecast</p><h2>Next-hour rainfall signal</h2></div>
        {ml?.enabled ? <>
          <strong className={styles.mlValue}>{ml.predictedPrecipitationMm} mm</strong>
          <p className={styles.method}>Predicted precipitation for the next hour from live Open-Meteo inputs. This is not a flood probability.</p>
          <div className={styles.mlMeta}><span>Model: {ml.algorithm || ml.model}</span><span>Input: {ml.inputTimestamp || 'Data unavailable'}</span><span>Source: {ml.source || 'Open-Meteo'}</span></div>
          <p className={styles.method}><b>Top model drivers:</b> {(ml.drivers || []).slice(0, 4).map((driver) => driver.feature).join(' · ') || 'Data unavailable'}</p>
        </> : <p className={styles.empty}>{ml?.reason || 'ML precipitation forecast is unavailable for this hazard.'}</p>}
      </section>
      <section className={styles.analyticsSection}>
        <div><p className={styles.eyebrow}>Risk analytics</p><h2>Forecast risk profile</h2></div>
        {analytics ? <>
          <div className={styles.analyticsMetrics}><div><span>Current</span><b>{Math.round(analytics.current.score * 100)}%</b></div><div><span>Average</span><b>{Math.round(analytics.average * 100)}%</b></div><div><span>Maximum</span><b>{Math.round(analytics.maximum * 100)}%</b></div><div><span>Minimum</span><b>{Math.round(analytics.minimum * 100)}%</b></div><div><span>Peak</span><b>{new Date(analytics.peak.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div><div><span>Elevated periods</span><b>{analytics.duration}</b></div></div>
          <div className={styles.analyticsChart} aria-label="Risk versus time"><div className={styles.chartAxis}>{analytics.points.map((point) => <div key={point.time} style={{ height: `${Math.max(8, Math.round(point.score * 100))}%` }} title={`${point.level} · ${Math.round(point.score * 100)}%`}><span /></div>)}</div><div className={styles.chartLabels}>{analytics.points.map((point) => <small key={point.time}>{new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}</small>)}</div></div>
        </> : <p className={styles.empty}>Insufficient forecast data for analytics.</p>}
        <div className={styles.guidanceNote}><b>Trusted guidance</b><span>Verified official guidance is unavailable because no trusted guidance source is configured. This is a weather-derived assessment only.</span></div>
      </section>
    </section>
  );
}
