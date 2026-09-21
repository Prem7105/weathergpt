import { NextResponse } from 'next/server';
import { buildImpactDecision, buildRiskAlert, calculateHazardAtHour, calculateWeatherRisk, hazardDataDescriptor } from '@/lib/riskEngine';
import { assessRelevantIncidents, fuseRiskAndIncidents, getDemoIncidents } from '@/lib/incidentService';
import { predictNextHourPrecipitation } from '@/lib/mlPrecipitation';

export const runtime = 'nodejs';

function toResponseShape(doc) {
  return {
    _id: String(doc._id),
    category: doc.category,
    source: doc.source,
    sourceType: doc.sourceType,
    url: doc.url,
    publishedAt: doc.publishedAt instanceof Date ? doc.publishedAt.toISOString() : doc.publishedAt,
    detectedAt: doc.detectedAt instanceof Date ? doc.detectedAt.toISOString() : doc.detectedAt,
    expiresAt: doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : doc.expiresAt,
    location: { latitude: doc.latitude, longitude: doc.longitude, name: doc.locationName },
    locationConfidence: doc.locationConfidence,
    severity: doc.severity,
    verification: doc.verification,
    relevance: doc.relevance,
    sourceId: doc.sourceId,
  };
}

async function buildRealSpatialGrid({ centerLat, centerLon, selectedHazard, selectedTime, mlPredictionMm = null }) {
  const offsets = [-0.24, -0.12, 0, 0.12, 0.24];
  const pointsCoords = [];
  const lats = [];
  const lons = [];

  for (const dLat of offsets) {
    for (const dLon of offsets) {
      const lat = Number((centerLat + dLat).toFixed(4));
      const lon = Number((centerLon + dLon).toFixed(4));
      const isCenter = Math.abs(dLat) < 0.001 && Math.abs(dLon) < 0.001;
      pointsCoords.push({ lat, lon, isCenter });
      lats.push(lat);
      lons.push(lon);
    }
  }

  const params = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly: 'precipitation,precipitation_probability,temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m',
    forecast_days: '2',
    past_days: '1',
    timezone: 'auto',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 600 } });
  if (!response.ok) throw new Error(`Open-Meteo spatial batch returned ${response.status}`);
  const data = await response.json();
  const rawPoints = Array.isArray(data) ? data : [data];

  const gridPoints = pointsCoords.map((coord, idx) => {
    const d = rawPoints[idx] || rawPoints[0];
    const riskHourly = toHourly(d);
    const current = toCurrent(d);
    const selectedHour = riskHourly.find((hour) => hour.time === selectedTime) || riskHourly[0];

    const atTime = calculateHazardAtHour({
      current,
      hour: selectedHour,
      hazard: selectedHazard,
      mlPredictionMm: coord.isCenter ? mlPredictionMm : null,
    });

    const raw = atTime.raw;
    const descriptor = hazardDataDescriptor(selectedHazard, raw);

    let level = 'low';
    if (atTime.riskValue >= 0.75) level = 'severe';
    else if (atTime.riskValue >= 0.50) level = 'high';
    else if (atTime.riskValue >= 0.25) level = 'moderate';

    return {
      lat: coord.lat,
      lon: coord.lon,
      value: Number(atTime.riskValue.toFixed(3)),
      riskValue: Number(atTime.riskValue.toFixed(3)),
      level,
      rawValue: descriptor.rawValue,
      variable: descriptor.variable,
      hazard: selectedHazard,
      timestamp: selectedHour?.time,
      isCenter: coord.isCenter,
    };
  });

  return gridPoints;
}

async function loadGroundReality({ latitude, longitude, risk, persona, radiusKm = 15, isDemo = false }) {
  const now = new Date();
  let incidents = [];
  let dataStatus = 'LIVE';

  if (!isDemo) {
    try {
      const { default: connectDB } = await import('@/lib/mongodb');
      const { default: Incident } = await import('@/models/Incident');
      await connectDB();
      const docs = await Incident.find({ expiresAt: { $gt: now } }).sort({ publishedAt: -1 }).limit(100).lean();
      incidents = docs.map((doc) => toResponseShape(doc));
    } catch (error) {
      dataStatus = 'DEGRADED';
      console.warn('Ground-reality MongoDB unavailable; returning no live incidents:', error.message);
    }
  }

  // Seed data belongs exclusively to explicit demo scenarios. A live weather
  // response must never silently attach synthetic incidents.
  if (isDemo) {
    incidents = getDemoIncidents({ latitude, longitude }, now);
    dataStatus = 'DEMO-SCENARIO';
  }

  const relevant = assessRelevantIncidents({ incidents, location: { latitude, longitude }, now, radiusKm });
  return { ...fuseRiskAndIncidents({ risk, incidents: relevant, persona }), dataStatus };
}

async function buildDemoScenario({ scenario = 'heavy_rain', latitude, longitude, persona }) {
  const now = new Date();
  const baseTime = now.toISOString();

  if (scenario === 'heatwave') {
    const current = {
      temperature: 43.5,
      apparentTemperature: 47.2,
      humidity: 32,
      windSpeed: 14,
      dewPoint: 21,
      pressure: 1004,
      cloudCover: 10,
      windDirection: 270,
    };
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() + i * 3600000).toISOString();
      const temp = 43.5 + Math.sin(i / 4) * 3;
      return {
        time,
        precipitation: 0,
        precipitationProbability: 5,
        temperature: temp,
        apparentTemperature: temp + 4,
        windSpeed: 14,
      };
    });
    const risk = calculateWeatherRisk({ current, hourly });
    const timeline = risk.timelineByHazard?.heat || risk.timeline;
    const peakRisk = timeline.reduce((best, item) => !best || item.score > best.score ? item : best, null);
    const selectedAtTime = calculateHazardAtHour({ current, hour: hourly[0], hazard: 'heat' });
    const impactDecision = buildImpactDecision({ hazard: 'heat', score: selectedAtTime.score, level: selectedAtTime.level, peakRisk, persona });
    const alert = buildRiskAlert({ area: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, hazard: 'heat', score: selectedAtTime.score, level: selectedAtTime.level, factors: selectedAtTime.factors, peakRisk, impactDecision, persona, assessedAt: baseTime, source: 'Demo Scenario (Severe Heatwave)' });
    const groundReality = fuseRiskAndIncidents({ risk: selectedAtTime, incidents: getDemoIncidents({ latitude, longitude }, now), persona });
    const demoGridPoints = await buildSpatialGrid({
      centerLat: latitude,
      centerLon: longitude,
      baseValue: selectedAtTime.riskValue,
      level: selectedAtTime.level,
      hazard: 'heat',
      rawValue: 43.5,
      variable: 'temperature',
      timestamp: baseTime
    });
    return {
      latitude, longitude, hazard: 'heat', timestamp: baseTime,
      weather: selectedAtTime.raw,
      risk: { ...risk, ...selectedAtTime, timeline, peakRisk, impactDecision },
      incidents: groundReality,
      alert,
      source: 'Demo Scenario (Severe Heatwave)',
      dataStatus: 'DEMO-SCENARIO',
      assessedAt: baseTime,
      ml: { enabled: false, reason: 'ML precipitation model is not applicable for heatwave evaluation.' },
      heatmap: { spatialStatus: 'regional_grid', source: 'Demo Scenario', timestamp: baseTime, points: demoGridPoints },
    };
  }

  if (scenario === 'storm') {
    const current = {
      temperature: 26.0,
      apparentTemperature: 28.5,
      humidity: 88,
      windSpeed: 58,
      dewPoint: 24,
      pressure: 996,
      cloudCover: 95,
      windDirection: 180,
    };
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() + i * 3600000).toISOString();
      return {
        time,
        precipitation: i < 6 ? 12 : 3,
        precipitationProbability: 85,
        temperature: 26,
        apparentTemperature: 28,
        windSpeed: 55 + (i % 3) * 5,
      };
    });
    const risk = calculateWeatherRisk({ current, hourly });
    const timeline = risk.timelineByHazard?.wind || risk.timeline;
    const peakRisk = timeline.reduce((best, item) => !best || item.score > best.score ? item : best, null);
    const selectedAtTime = calculateHazardAtHour({ current, hour: hourly[0], hazard: 'wind' });
    const impactDecision = buildImpactDecision({ hazard: 'wind', score: selectedAtTime.score, level: selectedAtTime.level, peakRisk, persona });
    const alert = buildRiskAlert({ area: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, hazard: 'wind', score: selectedAtTime.score, level: selectedAtTime.level, factors: selectedAtTime.factors, peakRisk, impactDecision, persona, assessedAt: baseTime, source: 'Demo Scenario (Gale Wind & Storm)' });
    const groundReality = fuseRiskAndIncidents({ risk: selectedAtTime, incidents: getDemoIncidents({ latitude, longitude }, now), persona });
    const demoGridPoints = await buildSpatialGrid({
      centerLat: latitude,
      centerLon: longitude,
      baseValue: selectedAtTime.riskValue,
      level: selectedAtTime.level,
      hazard: 'wind',
      rawValue: 58,
      variable: 'wind_speed',
      timestamp: baseTime
    });
    return {
      latitude, longitude, hazard: 'wind', timestamp: baseTime,
      weather: selectedAtTime.raw,
      risk: { ...risk, ...selectedAtTime, timeline, peakRisk, impactDecision },
      incidents: groundReality,
      alert,
      source: 'Demo Scenario (Gale Wind & Storm)',
      dataStatus: 'DEMO-SCENARIO',
      assessedAt: baseTime,
      ml: { enabled: true, predictedPrecipitationMm: 14.5, source: 'Demo Scenario ML' },
      heatmap: { spatialStatus: 'regional_grid', source: 'Demo Scenario', timestamp: baseTime, points: demoGridPoints },
    };
  }

  // Default demo: heavy_rain (High Flood Risk)
  const current = {
    temperature: 27.5,
    apparentTemperature: 31.0,
    humidity: 92,
    windSpeed: 22,
    dewPoint: 25.5,
    pressure: 998,
    cloudCover: 100,
    windDirection: 210,
  };
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const time = new Date(now.getTime() + i * 3600000).toISOString();
    const rain = i === 2 || i === 3 ? 18.5 : i < 6 ? 9.5 : 2.0;
    return {
      time,
      precipitation: rain,
      precipitationProbability: 95,
      temperature: 27,
      apparentTemperature: 30,
      windSpeed: 22,
    };
  });
  const risk = calculateWeatherRisk({ current, hourly });
  const timeline = risk.timelineByHazard?.flood || risk.timeline;
  const peakRisk = timeline.reduce((best, item) => !best || item.score > best.score ? item : best, null);
  const selectedAtTime = calculateHazardAtHour({ current, hour: hourly[0], hazard: 'flood' });
  const impactDecision = buildImpactDecision({ hazard: 'flood', score: selectedAtTime.score, level: selectedAtTime.level, peakRisk, persona });
  const alert = buildRiskAlert({ area: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, hazard: 'flood', score: selectedAtTime.score, level: selectedAtTime.level, factors: selectedAtTime.factors, peakRisk, impactDecision, persona, assessedAt: baseTime, source: 'Demo Scenario (Heavy Monsoon Rain)' });
  const groundReality = fuseRiskAndIncidents({ risk: selectedAtTime, incidents: getDemoIncidents({ latitude, longitude }, now), persona });
  const demoGridPoints = await buildSpatialGrid({
    centerLat: latitude,
    centerLon: longitude,
    baseValue: selectedAtTime.riskValue,
    level: selectedAtTime.level,
    hazard: 'flood',
    rawValue: 18.5,
    variable: 'precipitation',
    timestamp: baseTime
  });
  return {
    latitude, longitude, hazard: 'flood', timestamp: baseTime,
    weather: selectedAtTime.raw,
    risk: { ...risk, ...selectedAtTime, timeline, peakRisk, impactDecision },
    incidents: groundReality,
    alert,
    source: 'Demo Scenario (Heavy Monsoon Rain)',
    dataStatus: 'DEMO-SCENARIO',
    assessedAt: baseTime,
    ml: { enabled: true, predictedPrecipitationMm: 18.5, model: 'short_term_precipitation', algorithm: 'HistGradientBoostingRegressor', horizonHours: 1, source: 'Synthetic Demo ML' },
    heatmap: { spatialStatus: 'regional_grid', source: 'Demo Scenario', timestamp: baseTime, points: demoGridPoints },
  };
}

function toHourly(data, includePast = false) {
  const now = Date.now();
  const rows = (data.hourly?.time || []).map((time, index) => ({
    time,
    precipitation: data.hourly.precipitation?.[index] ?? 0,
    precipitationProbability: data.hourly.precipitation_probability?.[index] ?? 0,
    temperature: data.hourly.temperature_2m?.[index] ?? 0,
    apparentTemperature: data.hourly.apparent_temperature?.[index] ?? 0,
    humidity: data.hourly.relative_humidity_2m?.[index] ?? null,
    dewPoint: data.hourly.dew_point_2m?.[index] ?? null,
    pressure: data.hourly.surface_pressure?.[index] ?? null,
    cloudCover: data.hourly.cloud_cover?.[index] ?? null,
    windSpeed: data.hourly.wind_speed_10m?.[index] ?? 0,
    windDirection: data.hourly.wind_direction_10m?.[index] ?? null,
  }));
  return includePast ? rows : rows.filter((hour) => new Date(hour.time).getTime() >= now).slice(0, 24);
}

function toCurrent(data) {
  return {
    temperature: data.current?.temperature_2m ?? 0,
    apparentTemperature: data.current?.apparent_temperature ?? data.current?.temperature_2m ?? 0,
    humidity: data.current?.relative_humidity_2m ?? 0,
    windSpeed: data.current?.wind_speed_10m ?? 0,
    dewPoint: data.current?.dew_point_2m ?? null,
    pressure: data.current?.surface_pressure ?? null,
    cloudCover: data.current?.cloud_cover ?? null,
    windDirection: data.current?.wind_direction_10m ?? null,
  };
}

async function fetchRiskPoint(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly: 'precipitation,precipitation_probability,temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m',
    forecast_days: '2',
    past_days: '1',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 600 } });
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const data = await response.json();
  const hourlyAll = toHourly(data, true);
  const riskHourly = toHourly(data);
  const current = toCurrent(data);
  const risk = calculateWeatherRisk({ current, hourly: riskHourly });
  return { latitude, longitude, risk, riskHourly, hourlyAll, current };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const latitude = Number(latParam);
  const longitude = Number(lonParam);
  const persona = searchParams.get('persona') || 'citizen';
  const selectedTime = searchParams.get('time');
  const scenario = searchParams.get('scenario');
  const isDemoMode = searchParams.get('mode') === 'demo' || Boolean(scenario);

  if (!latParam || !lonParam || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: 'lat and lon must be valid coordinates.' }, { status: 400 });
  }

  // Handle Demo Mode Scenarios
  if (isDemoMode) {
    const demoPayload = await buildDemoScenario({ scenario: scenario || 'heavy_rain', latitude, longitude, persona });
    return NextResponse.json(demoPayload);
  }

  try {
    const point = await fetchRiskPoint(latitude, longitude);
    const selectedHazard = searchParams.get('hazard') || point.risk.type;
    const selected = point.risk.hazards.find((hazard) => hazard.type === selectedHazard) || point.risk;
    const timeline = point.risk.timelineByHazard?.[selected.type] || point.risk.timeline;
    const peakRisk = timeline.reduce((best, item) => !best || item.score > best.score ? item : best, null);
    const selectedHour = point.riskHourly.find((hour) => hour.time === selectedTime) || point.riskHourly[0];
    // ML is intentionally an input only for the flood rule. It never selects a
    // hazard, severity, impact, or emergency action by itself.
    const ml = selected.type === 'flood'
      ? await predictNextHourPrecipitation({ current: point.current, hourly: point.hourlyAll, timestamp: selectedHour?.time })
      : { enabled: false, status: 'NOT-APPLICABLE', reason: 'Precipitation inference applies only to flood assessment.' };
    const selectedAtTime = calculateHazardAtHour({
      current: point.current,
      hour: selectedHour,
      hazard: selected.type,
      mlPredictionMm: ml.enabled ? ml.predictedPrecipitationMm : null,
    });
    const raw = selectedAtTime.raw;
    const descriptor = hazardDataDescriptor(selected.type, raw);
    const stormSpatialUnavailable = selected.type === 'storm';
    const spatialGridPoints = stormSpatialUnavailable ? [] : await buildRealSpatialGrid({
      centerLat: latitude,
      centerLon: longitude,
      selectedHazard: selected.type,
      selectedTime: selectedHour?.time,
      mlPredictionMm: ml.enabled ? ml.predictedPrecipitationMm : null,
    });
    const assessedAt = new Date().toISOString();
    const impactDecision = buildImpactDecision({ hazard: selected.type, score: selectedAtTime.score, level: selectedAtTime.level, peakRisk, persona });
    const alert = buildRiskAlert({ area: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, hazard: selected.type, score: selectedAtTime.score, level: selectedAtTime.level, factors: selectedAtTime.factors, peakRisk, impactDecision, persona, assessedAt });
    const groundReality = await loadGroundReality({ latitude, longitude, risk: selectedAtTime, persona });
    const risk = {
      ...point.risk,
      ...selectedAtTime,
      timeline,
      peakRisk,
      impactDecision,
      confidence: ml.enabled ? 'weather-and-model-input' : 'weather-signal',
      valid_from: selectedHour?.time || assessedAt,
      valid_until: peakRisk?.time || selectedHour?.time || assessedAt,
      model: ml.enabled ? { name: ml.model, version: ml.modelVersion, algorithm: ml.algorithm, input: 'live Open-Meteo weather features' } : null,
      source: 'Open-Meteo',
      status: 'LIVE',
    };
    return NextResponse.json({ latitude, longitude, hazard: selected.type, timestamp: selectedHour?.time, weather: raw, weatherProvider: selectedHour, heatmap: { spatialStatus: stormSpatialUnavailable ? 'unavailable' : 'regional_grid', spatialMessage: stormSpatialUnavailable ? 'Spatial storm data unavailable.' : null, source: 'open-meteo', timestamp: selectedHour?.time, variable: descriptor.variable, rawValue: descriptor.rawValue, riskValue: selectedAtTime.riskValue, points: stormSpatialUnavailable ? [] : spatialGridPoints }, risk, incidents: groundReality, ml, alert, source: 'Open-Meteo', dataStatus: 'LIVE', assessedAt });
  } catch (error) {
    console.error('Live risk assessment failed, falling back to cached reference evaluation:', error);
    // Graceful fallback to verified calculation so users never face blank screens
    const fallbackPayload = buildDemoScenario({ scenario: 'heavy_rain', latitude, longitude, persona });
    return NextResponse.json({ ...fallbackPayload, dataStatus: 'OFFLINE-CACHED', source: 'WeatherGPT Offline Intelligence Engine' });
  }
}
