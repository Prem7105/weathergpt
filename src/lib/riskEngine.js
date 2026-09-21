const LEVELS = [
  { min: 0.75, label: 'severe' },
  { min: 0.5, label: 'high' },
  { min: 0.25, label: 'moderate' },
  { min: 0, label: 'low' },
];

export function toFinite(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export const clamp = (value) => Math.max(0, Math.min(1, toFinite(value, 0)));

export function riskLevel(score) {
  const safeScore = clamp(score);
  const matched = LEVELS.find((level) => safeScore >= level.min);
  return matched ? matched.label : 'low';
}

export function riskPriority(level) {
  return ({ severe: 'Critical', high: 'High', moderate: 'Moderate', low: 'Informational' }[level] || 'Informational');
}

export function hazardDataDescriptor(hazard, raw = {}) {
  const descriptors = {
    flood: { variable: 'precipitation', secondaryVariable: 'precipitation_probability', rawValue: toFinite(raw.precipitation, 0), spatialSupported: true },
    heat: { variable: 'temperature/apparent_temperature', rawValue: Math.max(toFinite(raw.temperature, 0), toFinite(raw.apparentTemperature, 0)), spatialSupported: true },
    wind: { variable: 'wind_speed_10m', rawValue: toFinite(raw.windSpeed, 0), spatialSupported: true },
    storm: { variable: 'wind_speed_10m + precipitation_probability', rawValue: null, spatialSupported: false },
  };
  return descriptors[hazard] || descriptors.flood;
}

const priorityRank = { Informational: 0, Moderate: 1, High: 2, Critical: 3 };

export function buildRiskAlert({
  area = 'selected area',
  hazard = 'weather',
  score = 0,
  level = riskLevel(score),
  factors = [],
  peakRisk = null,
  impactDecision = null,
  persona = 'citizen',
  source = 'Open-Meteo',
  assessedAt = new Date().toISOString(),
}) {
  const safeScore = clamp(score);
  const peakScore = peakRisk && Number.isFinite(Number(peakRisk.score)) ? clamp(peakRisk.score) : safeScore;
  const effectiveLevel = priorityRank[riskPriority(peakRisk?.level || level)] > priorityRank[riskPriority(level)]
    ? (peakRisk?.level || level)
    : level;
  const alertLevel = riskPriority(effectiveLevel);
  const escalated = priorityRank[alertLevel] > priorityRank[riskPriority(level)];
  const expectedTime = peakRisk?.time || null;
  const timing = expectedTime && new Date(expectedTime).getTime() > Date.now() ? 'upcoming' : 'current';
  const drivers = (factors || [])
    .filter((factor) => factor?.label && factor?.value != null)
    .map((factor) => ({ label: String(factor.label), value: String(factor.value), contribution: toFinite(factor.contribution, 0) }));
  const impacts = impactDecision?.impacts || [];
  const actions = impactDecision?.decision?.recommendations || [];
  const signature = `${hazard || 'weather'}:${expectedTime || 'now'}`;

  return {
    eventId: signature,
    riskSignature: signature,
    hazard: hazard || 'weather',
    area: String(area),
    severity: effectiveLevel,
    level: effectiveLevel,
    alertLevel,
    priority: alertLevel,
    score: peakScore,
    expectedTime,
    timing,
    escalation: escalated ? `Risk is expected to escalate from ${riskPriority(level)} to ${alertLevel} by the peak period.` : null,
    drivers,
    reason: drivers.map((driver) => `${driver.label}: ${driver.value}`).join('; ') || 'Live weather signals indicate elevated risk.',
    impacts,
    impact: impacts[0] || null,
    actions,
    recommendedAction: actions[0] || 'Monitor live conditions and official guidance.',
    persona: String(persona),
    source: String(source),
    method: 'rule-based assessment from live weather signals',
    dataStatus: 'LIVE',
    official: false,
    assessedAt,
  };
}

export function shouldSendRiskAlert(existing, alert) {
  if (!alert || priorityRank[alert.alertLevel] < priorityRank.Moderate) return false;
  if (!existing) return true;
  const sameEvent = existing.riskSignature === alert.riskSignature || existing.eventId === alert.eventId;
  if (!sameEvent) return true;
  const previousLevel = existing.severityLevel || existing.alertLevel || existing.level || 'Informational';
  return priorityRank[alert.alertLevel] > priorityRank[previousLevel];
}

export function calculateWeatherRisk({ current = {}, hourly = [] }) {
  const safeHourly = Array.isArray(hourly) ? hourly : [];
  const upcoming = safeHourly.slice(0, 24);
  const rain24h = upcoming.reduce((total, hour) => total + toFinite(hour.precipitation ?? hour.rain, 0), 0);
  const rainProbabilities = upcoming.map((hour) => toFinite(hour.precipitationProbability ?? hour.rainChance, 0));
  const rainChance = rainProbabilities.length > 0 ? Math.max(0, ...rainProbabilities) : 0;
  
  const temperature = toFinite(current.temperature ?? current.temp, 0);
  const apparentTemperature = toFinite(current.apparentTemperature ?? current.feelsLike, temperature);
  const humidity = Math.max(0, Math.min(100, toFinite(current.humidity, 0)));
  const windSpeed = Math.max(0, toFinite(current.windSpeed, 0));

  const flood = clamp((rain24h / 80) * 0.62 + (rainChance / 100) * 0.28 + (humidity / 100) * 0.1);
  const heat = clamp(((Math.max(temperature, apparentTemperature) - 32) / 14) * 0.75 + (humidity / 100) * 0.25);
  const wind = clamp(windSpeed / 55);
  const storm = clamp((windSpeed / 75) * 0.7 + (rainChance / 100) * 0.3);

  const hazards = [
    {
      type: 'flood',
      score: flood,
      factors: [
        { label: '24-hour rainfall', value: `${rain24h.toFixed(1)} mm`, contribution: clamp((rain24h / 80) * 0.62) },
        { label: 'Peak rain probability', value: `${Math.round(rainChance)}%`, contribution: clamp((rainChance / 100) * 0.28) },
        { label: 'Humidity', value: `${Math.round(humidity)}%`, contribution: clamp((humidity / 100) * 0.1) },
      ],
    },
    {
      type: 'heat',
      score: heat,
      factors: [
        { label: 'Apparent temperature', value: `${apparentTemperature.toFixed(1)} C`, contribution: clamp(((Math.max(temperature, apparentTemperature) - 32) / 14) * 0.75) },
        { label: 'Humidity', value: `${Math.round(humidity)}%`, contribution: clamp((humidity / 100) * 0.25) },
      ],
    },
    {
      type: 'wind',
      score: wind,
      factors: [
        { label: 'Wind speed', value: `${windSpeed.toFixed(1)} km/h`, contribution: wind },
      ],
    },
    {
      type: 'storm',
      score: storm,
      factors: [
        { label: 'Wind speed', value: `${windSpeed.toFixed(1)} km/h`, contribution: clamp((windSpeed / 75) * 0.7) },
        { label: 'Peak rain probability', value: `${Math.round(rainChance)}%`, contribution: clamp((rainChance / 100) * 0.3) },
      ],
    },
  ];

  const primary = [...hazards].sort((a, b) => b.score - a.score)[0];
  const primaryTimeline = buildRiskTimeline(safeHourly, current, primary.type);

  return {
    ...primary,
    score: Number(primary.score.toFixed(3)),
    level: riskLevel(primary.score),
    confidence: 'weather-signal',
    method: 'transparent-weather-risk-v1',
    hazards: hazards.map((hazard) => ({ ...hazard, score: Number(hazard.score.toFixed(3)), level: riskLevel(hazard.score) })),
    timeline: primaryTimeline,
    timelineByHazard: Object.fromEntries(hazards.map((hazard) => [hazard.type, buildRiskTimeline(safeHourly, current, hazard.type)])),
    peakRisk: findPeakRisk(primaryTimeline),
    cyclone: { status: 'unavailable', message: 'No official cyclone track feed is configured; storm signals do not confirm a cyclone.' },
    assessedAt: new Date().toISOString(),
  };
}

export function calculateHazardAtHour({ current = {}, hour = {}, hazard = 'flood', mlPredictionMm = null }) {
  const rain = Math.max(0, toFinite(hour.precipitation, 0));
  const probability = Math.max(0, Math.min(100, toFinite(hour.precipitationProbability, 0)));
  const temperature = toFinite(hour.temperature ?? current.temperature, 0);
  const apparentTemperature = toFinite(hour.apparentTemperature ?? current.apparentTemperature, temperature);
  const windSpeed = Math.max(0, toFinite(hour.windSpeed ?? current.windSpeed, 0));
  const humidity = Math.max(0, Math.min(100, toFinite(current.humidity, 0)));

  const hasMlPrediction = Number.isFinite(Number(mlPredictionMm)) && Number(mlPredictionMm) >= 0;
  const modelRainScore = hasMlPrediction ? clamp(Number(mlPredictionMm) / 12) : 0;
  const forecastFloodScore = clamp((rain / 12) * 0.65 + (probability / 100) * 0.35);

  const scores = {
    flood: hasMlPrediction ? clamp(forecastFloodScore * 0.8 + modelRainScore * 0.2) : forecastFloodScore,
    heat: clamp(((Math.max(temperature, apparentTemperature) - 32) / 14) * 0.75 + (humidity / 100) * 0.25),
    wind: clamp(windSpeed / 55),
    storm: clamp((windSpeed / 75) * 0.7 + (probability / 100) * 0.3),
  };

  const score = scores[hazard] ?? scores.flood;
  const factors = hazard === 'heat'
    ? [
        { label: 'Temperature', value: `${temperature.toFixed(1)} C`, contribution: clamp(((Math.max(temperature, apparentTemperature) - 32) / 14) * 0.75) },
        { label: 'Humidity', value: `${Math.round(humidity)}%`, contribution: clamp((humidity / 100) * 0.25) },
      ]
    : hazard === 'wind' || hazard === 'storm'
      ? [
          { label: 'Wind speed', value: `${windSpeed.toFixed(1)} km/h`, contribution: clamp(windSpeed / (hazard === 'storm' ? 75 : 55)) },
          ...(hazard === 'storm' ? [{ label: 'Precipitation probability', value: `${Math.round(probability)}%`, contribution: clamp((probability / 100) * 0.3) }] : []),
        ]
      : [
          { label: 'Precipitation', value: `${rain.toFixed(1)} mm`, contribution: clamp((rain / 12) * 0.65) },
          { label: 'Precipitation probability', value: `${Math.round(probability)}%`, contribution: clamp((probability / 100) * 0.35) },
          ...(hasMlPrediction ? [{ label: 'ML next-hour precipitation', value: `${Number(mlPredictionMm).toFixed(1)} mm`, contribution: modelRainScore * 0.2 }] : []),
        ];

  const raw = { precipitation: rain, precipitationProbability: probability, temperature, apparentTemperature, windSpeed };
  const descriptor = hazardDataDescriptor(hazard, raw);
  return {
    type: hazard,
    score: Number(score.toFixed(3)),
    level: riskLevel(score),
    factors,
    raw,
    variable: descriptor.variable,
    rawValue: descriptor.rawValue,
    riskValue: Number(score.toFixed(3)),
    time: hour.time,
    method: hasMlPrediction && hazard === 'flood'
      ? 'ML precipitation prediction plus deterministic risk rules'
      : 'deterministic weather risk rules',
  };
}

function buildRiskTimeline(hourly, current, hazardType = 'flood') {
  if (!Array.isArray(hourly) || hourly.length === 0) return [];
  return hourly.filter((_, index) => index % 4 === 0).slice(0, 6).map((hour) => {
    const rain = Math.max(0, toFinite(hour.precipitation, 0));
    const probability = Math.max(0, Math.min(100, toFinite(hour.precipitationProbability, 0)));
    const temp = toFinite(hour.apparentTemperature ?? hour.temperature ?? current.temperature, 0);
    const wind = Math.max(0, toFinite(hour.windSpeed ?? current.windSpeed, 0));
    const humidity = Math.max(0, Math.min(100, toFinite(current.humidity, 0)));

    const score = hazardType === 'heat'
      ? clamp(((temp - 32) / 14) * 0.75 + (humidity / 100) * 0.25)
      : hazardType === 'wind'
        ? clamp(wind / 55)
        : hazardType === 'storm'
          ? clamp((wind / 75) * 0.7 + (probability / 100) * 0.3)
          : clamp((rain / 12) * 0.65 + (probability / 100) * 0.35);

    return { time: hour.time, score: Number(score.toFixed(3)), level: riskLevel(score) };
  });
}

function findPeakRisk(timeline) {
  if (!timeline || !timeline.length) return null;
  const peak = timeline.reduce((best, point) => point.score > best.score ? point : best, timeline[0]);
  return { time: peak.time, score: peak.score, level: peak.level };
}

export function buildImpactDecision({ hazard = 'flood', score = 0.5, level = riskLevel(score), peakRisk = null, persona = 'citizen' }) {
  const normalizedPersona = persona === 'disaster_manager' ? 'disaster' : persona;

  // Deterministic physical impacts based on hazard and severity level
  const impactsByHazard = {
    flood: level === 'severe'
      ? [
          'Severe road waterlogging and underpass inundation across arterial routes.',
          'Field water stagnation risking crop root suffocation; drainage outlets overwhelmed.',
          'Critical freight delivery corridors face major choke-points and delays.',
        ]
      : level === 'high'
        ? [
            'Localized street waterlogging and flash runoff in low-lying basins.',
            'Field access compromised; standing water accumulation on unpaved agricultural tracks.',
            'Urban traffic slowdowns and transit corridor delays during peak rain.',
          ]
        : level === 'moderate'
          ? [
              'Minor surface runoff; standard municipal and field drainage sufficient.',
              'Slight traffic slowdowns and puddling in poorly drained pockets.',
            ]
          : [
              'No significant flood impacts expected under current precipitation levels.',
            ],
    heat: level === 'severe' || level === 'high'
      ? [
          'Dangerous thermal stress; prolonged outdoor activity risks heat exhaustion or stroke.',
          'Accelerated soil moisture evaporation stressing kharif/rabi crops.',
          'High risk of tire blowouts and refrigeration degradation for freight transit.',
        ]
      : [
          'Moderate midday heat; increased hydration recommended for outdoor activities.',
        ],
    wind: level === 'severe' || level === 'high'
      ? [
          'Structural hazard: tree limb snapping, tin roof dislodgement, and power line damage.',
          'Severe rollover hazard for high-sided commercial freight on open bypasses.',
          'Elevated site danger: immediate wind cut-off required for tower cranes and scaffolding.',
        ]
      : [
          'Breezy conditions; minor loose debris on roads and construction sites.',
        ],
    storm: level === 'severe' || level === 'high'
      ? [
          'Convective squalls with sudden wind shear, lightning risk, and localized flash floods.',
          'Localized electrical grid disruption and transport corridor obstruction.',
          'Dangerous conditions for elevated construction, open transport, and field operations.',
        ]
      : [
          'Convective cloud formation with potential brief showers; monitor radar.',
        ],
  };

  const impacts = impactsByHazard[hazard] || ['Weather-related disruption is possible; monitor the live forecast.'];

  // Distinct, persona-specific action recommendations
  const personaAdvice = {
    citizen: hazard === 'heat'
      ? ['Avoid direct sun exposure between 12 PM and 4 PM.', 'Carry water, wear light cotton clothing, and plan errands for cooler hours.']
      : hazard === 'wind' || hazard === 'storm'
        ? ['Stay indoors away from glass windows, tin sheds, and overhead power cables.', 'Avoid parking vehicles under large trees or weak structures.']
        : ['Avoid unnecessary travel through low-lying areas and known waterlogged underpasses.', 'Monitor official traffic advisories and keep emergency contacts handy.'],

    farmer: hazard === 'heat'
      ? ['Shift irrigation and field work to early morning or post-sunset hours.', 'Provide shaded shelter, ventilation, and adequate drinking water for farm livestock.']
      : hazard === 'wind' || hazard === 'storm'
        ? ['Provide mechanical support/staking for standing tall crops (banana, sugarcane, papaya).', 'Postpone chemical/pesticide spraying to prevent drift and wash-off.']
        : ['Immediately pause field work and postpone scheduled chemical spraying.', 'Inspect and clear field bunds and drainage outlets to avoid water stagnation.'],

    logistics: hazard === 'heat'
      ? ['Verify temperature-controlled refrigerated trailers before long-haul dispatch.', 'Schedule heavy vehicle transit for night and early morning hours.']
      : hazard === 'wind' || hazard === 'storm'
        ? ['Halt high-sided container trucks on open expressways during peak wind gusts.', 'Secure cargo tarpaulins and mandate reduced highway speeds.']
        : ['Reroute deliveries away from vulnerable low-lying underpasses and flood basins.', 'Reschedule transit windows around the forecast peak rainfall window to prevent cargo spoilage.'],

    construction: hazard === 'heat'
      ? ['Mandate shaded rest breaks every 45 minutes and provide electrolyte hydration onsite.', 'Shift heavy concrete curing and masonry work away from peak midday sun.']
      : hazard === 'wind' || hazard === 'storm'
        ? ['Enforce immediate tower crane wind cut-off (halt lifting above 38 km/h).', 'Secure scaffolding sheeting, loose metal sheets, and elevated work platforms.']
        : ['Suspend concrete pouring operations to prevent surface wash-off and structural weakness.', 'Dewater excavated foundation trenches and inspect temporary shoring walls.'],

    authority: hazard === 'heat'
      ? ['Activate civic cooling shelters and ensure continuous drinking water stations.', 'Alert emergency medical response teams for potential surge in heat cases.']
      : hazard === 'wind' || hazard === 'storm'
        ? ['Pre-position emergency tree-clearing squads and coordinate with power utilities.', 'Issue public advisory warning against standing near hoardings and billboards.']
        : ['Deploy dewatering pump teams to pre-identified vulnerable waterlogging hot-spots.', 'Activate civic traffic diversions and monitor low-lying settlement flood levels.'],

    fisherman: [
      'Check official INCOIS and IMD marine advisories before venturing out.',
      'Do not venture into deep sea during adverse wind and wave warnings; secure boats ashore.',
    ],

    disaster: [
      'Activate Stage 2 emergency preparedness protocol and mobilize rescue squads.',
      'Prioritize surveillance of low-lying flood basins and arterial evacuation corridors.',
    ],
  }[normalizedPersona] || ['Monitor the live forecast and follow local authority guidance.'];

  const avoid = level === 'high' || level === 'severe'
    ? ['Avoid non-essential transit through exposed or flood-prone corridors during the peak window.']
    : ['Avoid making emergency decisions based solely on raw weather scores.'];

  return {
    hazard,
    level,
    score: Number(toFinite(score, 0).toFixed(3)),
    peakRisk: peakRisk || null,
    impacts,
    persona: normalizedPersona,
    decision: {
      priority: level === 'severe' ? 'urgent' : level === 'high' ? 'high' : 'monitor',
      recommendations: [...personaAdvice],
      avoid,
      monitor: ['Recheck live weather updates and official alerts before the forecast peak time.'],
      escalation: level === 'high' || level === 'severe'
        ? 'Follow local district disaster management authority (DDMA) instructions if an emergency warning is issued.'
        : 'No emergency escalation indicated by this weather assessment.',
    },
    method: 'deterministic contextual impact and persona decision calculation',
  };
}
