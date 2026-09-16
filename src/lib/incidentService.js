const MAX_INCIDENT_AGE_MS = 6 * 60 * 60 * 1000;
const VERIFICATION_LEVELS = ['OFFICIAL', 'CORROBORATED', 'REPORTED', 'COMMUNITY_REPORT'];
const INCIDENT_TYPES = ['ROAD_BLOCK', 'FLOODING', 'BRIDGE_CLOSURE', 'LANDSLIDE', 'POWER_OUTAGE', 'EVACUATION', 'FIRE', 'TRANSPORT_DISRUPTION', 'WATERLOGGING'];

export function distanceKm(from, to) {
  const radians = (value) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeIncident(input, detectedAt = new Date()) {
  if (!input || !INCIDENT_TYPES.includes(input.category) || !VERIFICATION_LEVELS.includes(input.verification)) return null;
  const publishedAt = new Date(input.publishedAt);
  const latitude = Number(input.location?.latitude);
  const longitude = Number(input.location?.longitude);
  if (!Number.isFinite(publishedAt.getTime()) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (!String(input.source || '').trim() || !String(input.sourceType || '').trim()) return null;
  return {
    id: String(input.id || `${input.category}-${publishedAt.toISOString()}-${latitude.toFixed(3)}-${longitude.toFixed(3)}`),
    category: input.category,
    source: String(input.source).trim().slice(0, 160),
    sourceType: String(input.sourceType).trim().slice(0, 80),
    url: /^https:\/\//i.test(input.url || '') ? input.url : null,
    publishedAt: publishedAt.toISOString(),
    detectedAt: new Date(detectedAt).toISOString(),
    location: { latitude, longitude, name: String(input.location?.name || 'Reported location').slice(0, 160) },
    locationConfidence: Math.max(0, Math.min(1, Number(input.locationConfidence ?? 0))),
    severity: ['low', 'moderate', 'high', 'critical'].includes(input.severity) ? input.severity : 'moderate',
    verification: input.verification,
    relevance: Math.max(0, Math.min(1, Number(input.relevance ?? 0))),
    expiresAt: new Date(input.expiresAt || publishedAt.getTime() + MAX_INCIDENT_AGE_MS).toISOString(),
  };
}

export function assessRelevantIncidents({ incidents = [], location, now = new Date(), radiusKm = 10 }) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return [];
  return incidents.map((item) => normalizeIncident(item, now)).filter(Boolean).map((incident) => ({
    ...incident,
    distanceKm: Number(distanceKm(location, incident.location).toFixed(1)),
  })).filter((incident) => (
    incident.distanceKm <= radiusKm
    && new Date(incident.publishedAt).getTime() <= now.getTime()
    && new Date(incident.expiresAt).getTime() > now.getTime()
    && incident.locationConfidence >= 0.5
    && incident.relevance >= 0.5
  )).sort((a, b) => a.distanceKm - b.distanceKm || new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function fuseRiskAndIncidents({ risk, incidents, persona = 'citizen' }) {
  const relevant = incidents || [];
  if (!relevant.length) return { status: 'no-relevant-incidents', incidents: [], advisory: null };
  const incident = relevant[0];
  const action = {
    citizen: 'Avoid the affected route and check official local updates before travelling.',
    farmer: 'Avoid the affected field road and plan an alternate access route.',
    logistics: 'Reroute deliveries away from the reported disruption and confirm road access.',
    construction: 'Review site access and postpone vehicle movements through the affected area.',
    authority: 'Verify the report and monitor the affected access corridor.',
  }[persona] || 'Check the affected area before acting.';
  return {
    status: 'situational-awareness',
    incidents: relevant,
    advisory: {
      text: `${incident.category.replace('_', ' ').toLowerCase()} was ${incident.verification.toLowerCase()}-reported ${incident.distanceKm} km away; it may affect your route.`,
      action,
      prediction: risk ? { hazard: risk.type || risk.hazard, level: risk.level, method: risk.method } : null,
      observation: { verification: incident.verification, source: incident.source, publishedAt: incident.publishedAt },
    },
  };
}

export function getDemoIncidents(location = { latitude: 23.0225, longitude: 72.5714 }, now = new Date()) {
  const lat = Number(location.latitude ?? 23.0225);
  const lon = Number(location.longitude ?? 72.5714);
  const recentTime = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const expiryTime = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

  // Seed incident located approx 3 km offset from the active coordinate
  return [
    {
      id: `demo-roadblock-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      category: 'ROAD_BLOCK',
      source: 'District Traffic Police Advisory',
      sourceType: 'official',
      url: 'https://traffic.gov.in/advisories/urban-corridor-monsoon',
      publishedAt: recentTime,
      detectedAt: recentTime,
      expiresAt: expiryTime,
      location: {
        latitude: lat + 0.022,
        longitude: lon + 0.018,
        name: 'Arterial Ring Underpass / Main Access Road',
      },
      locationConfidence: 0.92,
      severity: 'high',
      verification: 'CORROBORATED',
      relevance: 0.95,
      sourceId: 'seed-urban-chokepoint',
    },
    {
      id: `demo-waterlogging-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      category: 'WATERLOGGING',
      source: 'Municipal Stormwater Operations',
      sourceType: 'official',
      url: 'https://mc.gov.in/flood-control',
      publishedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      detectedAt: recentTime,
      expiresAt: expiryTime,
      location: {
        latitude: lat - 0.025,
        longitude: lon - 0.02,
        name: 'Low-Lying Drainage Basin & Culvert',
      },
      locationConfidence: 0.88,
      severity: 'moderate',
      verification: 'OFFICIAL',
      relevance: 0.85,
      sourceId: 'seed-drainage-basin',
    },
  ];
}
