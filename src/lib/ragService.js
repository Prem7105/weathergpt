/**
 * WeatherGPT Lightweight In-Memory RAG Service
 * 
 * Provides deterministic retrieval of authoritative disaster, agromet, and
 * safety protocols (NDMA, IMD, ICAR) without vector-database complexity.
 * Trusted guidance is cleanly separated from generative LLM text.
 */

export const AUTHORITATIVE_KNOWLEDGE_BASE = [
  // Flood Protocols
  {
    id: 'ndma-flood-citizen',
    hazard: 'flood',
    severity: ['high', 'severe'],
    personas: ['citizen'],
    source: 'NDMA Standard Operating Procedure for Urban Flooding (2024)',
    title: 'NDMA Urban Flood Commuter Safety',
    guidance: 'Do not walk or drive through flood waters. Just 15 cm of moving water can knock an adult down; 30 cm can float small vehicles. Avoid underpasses and open drains.',
    keywords: ['flood', 'rain', 'water', 'underpass', 'travel', 'commute', 'umbrella', 'drive'],
  },
  {
    id: 'icar-flood-farmer',
    hazard: 'flood',
    severity: ['moderate', 'high', 'severe'],
    personas: ['farmer'],
    source: 'ICAR Agrometeorological Advisory Manual',
    title: 'ICAR Field Drainage & Standing Crop Protocol',
    guidance: 'Drain excess standing water immediately from crop root zones to prevent anoxia. Postpone fertilizer top-dressing and chemical sprays until 24-48 hours after heavy rainfall ceases.',
    keywords: ['crop', 'farmer', 'irrigation', 'water', 'drainage', 'spray', 'fertilizer', 'harvest'],
  },
  {
    id: 'nhai-flood-logistics',
    hazard: 'flood',
    severity: ['high', 'severe'],
    personas: ['logistics'],
    source: 'NHAI / MoRTH Freight Monsoon Operating Guidelines',
    title: 'Highway Freight Flood & Waterlogging Protocol',
    guidance: 'Halt vehicle movement on submerged highway sections where water level exceeds wheel hub height (approx 25 cm). Re-route commercial fleets via designated high-elevation bypasses.',
    keywords: ['logistics', 'truck', 'highway', 'delivery', 'corridor', 'reroute', 'transit', 'freight'],
  },
  {
    id: 'cpcb-flood-construction',
    hazard: 'flood',
    severity: ['high', 'severe'],
    personas: ['construction'],
    source: 'CPWD / National Building Code Safety Norms',
    title: 'Construction Site Inundation & Foundation Protocol',
    guidance: 'Immediately stop all open trenching and deep excavation during active heavy rainfall. Dewater sumps before resuming foundation concreting; inspect shoring walls for soil saturation collapse.',
    keywords: ['construction', 'concrete', 'crane', 'scaffold', 'trench', 'foundation', 'site'],
  },
  {
    id: 'ndma-flood-authority',
    hazard: 'flood',
    severity: ['high', 'severe'],
    personas: ['authority', 'disaster'],
    source: 'National Disaster Management Authority Flood Guideline Vol. 2',
    title: 'Civic Authority Emergency Inundation Mobilization',
    guidance: 'Pre-position high-capacity dewatering diesel pumps at vulnerable subway and low-lying residential basins. Issue preemptive traffic diversions and activate local flood shelter readiness.',
    keywords: ['authority', 'evacuation', 'shelter', 'drainage', 'pump', 'diversion', 'disaster'],
  },

  // Heatwave Protocols
  {
    id: 'ndma-heat-citizen',
    hazard: 'heat',
    severity: ['high', 'severe'],
    personas: ['citizen'],
    source: 'NDMA National Guidelines for Heatwave Action Plans (2024)',
    title: 'NDMA Heatwave Public Health Guidance',
    guidance: 'Avoid direct sunlight exposure between 12:00 PM and 4:00 PM. Drink adequate water and ORS (oral rehydration solution) even if not feeling thirsty. Wear light, loose-fitting cotton clothing.',
    keywords: ['heat', 'hot', 'sun', 'temperature', 'water', 'outside', 'travel', 'summer'],
  },
  {
    id: 'icar-heat-farmer',
    hazard: 'heat',
    severity: ['high', 'severe'],
    personas: ['farmer'],
    source: 'ICAR Central Research Institute for Dryland Agriculture (CRIDA)',
    title: 'Livestock & Crop Heat Stress Management',
    guidance: 'Apply light frequent irrigation during evening or night hours to lower micro-climate soil temperatures. Provide thatched roofs or wet gunny bags over cattle sheds to prevent heat stroke.',
    keywords: ['heat', 'crop', 'cattle', 'livestock', 'irrigation', 'stress', 'farmer'],
  },
  {
    id: 'osha-heat-construction',
    hazard: 'heat',
    severity: ['high', 'severe'],
    personas: ['construction', 'logistics'],
    source: 'Directorate General of Factory Advice Service and Labour Institutes (DGFASLI)',
    title: 'Occupational Heat Exposure in Outdoor Construction',
    guidance: 'Implement mandatory 15-minute rest breaks in shaded areas every hour when apparent temperature exceeds 40°C. Provide chilled drinking water with electrolytes at all work stations.',
    keywords: ['heat', 'worker', 'construction', 'labor', 'break', 'hydration', 'site'],
  },

  // Wind & Storm Protocols
  {
    id: 'imd-storm-wind',
    hazard: 'wind',
    severity: ['high', 'severe'],
    personas: ['citizen', 'logistics'],
    source: 'IMD Severe Weather Warning Standard Operating Procedure',
    title: 'IMD High Wind Gust Safety Directive',
    guidance: 'Avoid staying near old large trees, metal hoardings, and temporary tin roofs during gale winds. Drivers of high-sided container trucks must reduce speed to under 40 km/h or pull over safely.',
    keywords: ['wind', 'storm', 'cyclone', 'speed', 'truck', 'trees', 'roof', 'gust'],
  },
  {
    id: 'is-crane-construction',
    hazard: 'wind',
    severity: ['moderate', 'high', 'severe'],
    personas: ['construction'],
    source: 'Bureau of Indian Standards (IS 4573 / IS 13367) Tower Crane Safety',
    title: 'Tower Crane Wind Speed Limit & Scaffolding Lockout',
    guidance: 'Immediately halt tower crane lifting operations when wind speed exceeds 38 km/h (10.5 m/s). Weathervane crane jibs to free-slew in gale winds. Secure scaffolding catch-nets and loose sheets.',
    keywords: ['wind', 'crane', 'scaffold', 'lifting', 'construction', 'site'],
  },
  {
    id: 'incois-marine-fisherman',
    hazard: 'wind',
    severity: ['moderate', 'high', 'severe'],
    personas: ['fisherman'],
    source: 'INCOIS Coastal Ocean & Marine Safety Advisory',
    title: 'INCOIS Marine Squall & Deep Sea Safety Directive',
    guidance: 'Fishermen are strongly advised not to venture into open sea when wind speed exceeds 40-50 km/h or wave height exceeds 2.5 meters. Return to nearest harbor and anchor craft securely.',
    keywords: ['wind', 'sea', 'marine', 'wave', 'fish', 'boat', 'harbor', 'fisherman'],
  },
];

/**
 * Retrieve relevant authoritative guidelines using deterministic keyword and metadata matching.
 */
export function retrieveKnowledge({ hazard = 'flood', severity = 'moderate', persona = 'citizen', query = '' }) {
  const qTerms = String(query || '').toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const normalizedPersona = persona === 'disaster_manager' ? 'disaster' : persona;

  const scored = AUTHORITATIVE_KNOWLEDGE_BASE.map((item) => {
    let score = 0;

    // Hazard match
    if (item.hazard === hazard) score += 40;

    // Severity level match
    if (item.severity.includes(severity)) score += 25;

    // Persona match
    if (item.personas.includes(normalizedPersona)) score += 25;

    // Query keyword match
    for (const term of qTerms) {
      if (item.keywords.some((k) => k.includes(term) || term.includes(k))) {
        score += 8;
      }
    }

    return { ...item, matchScore: score };
  });

  return scored
    .filter((item) => item.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 2);
}

/**
 * Formats retrieved guidelines into prompt-friendly text.
 */
export function formatRAGContextForPrompt(items) {
  if (!items || !items.length) return '';
  const entries = items.map((item, idx) => `[${idx + 1}] ${item.title} (${item.source}):\n"${item.guidance}"`).join('\n\n');
  return `\n\nAUTHORITATIVE OFFICIAL GUIDELINES (Trusted Ground Truth — reflect these in safety advice):\n${entries}\n`;
}
