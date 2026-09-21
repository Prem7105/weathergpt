// Measurement regexes with lookaheads to avoid overlapping matches
const MEASUREMENT_PATTERNS = [
  // Wind speed with compound units (km/h, kmh, km/hr, kph, km per hour)
  { regex: /(-?\d+(?:\.\d+)?)\s*(?:km\s*\/?\s*h(?:r)?|kph|kilometers?\s*per\s*hour|kilometres?\s*per\s*hour)\b/gi, unit: 'kmh' },
  // Precipitation (mm, millimeters, millimetres)
  { regex: /(-?\d+(?:\.\d+)?)\s*(?:millimeters?|millimetres?|mm\b)/gi, unit: 'mm' },
  // Distance (km, kilometres, kilometers — not followed by /h or per hour)
  { regex: /(-?\d+(?:\.\d+)?)\s*(?:kilometres?|kilometers?|km(?!\s*\/?\s*h|\s*ph|\s*per\s*hour)\b)/gi, unit: 'km' },
  // Temperature (°C, degrees C, degrees celsius, °)
  { regex: /(-?\d+(?:\.\d+)?)\s*(?:°\s*C|degrees?\s*(?:celsius|c)?|celsius|°\b|(?<=\d)\s*C\b)/gi, unit: 'c' },
  // Percentage / Humidity / Probability
  { regex: /(-?\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?\b)/gi, unit: '%' },
  // Standalone decimal probability (e.g. 0.78, 0.95 when in 0.0 - 1.0 range followed by words like probability, risk, score, confidence)
  { regex: /\b(0\.\d{1,3})\b(?=\s*(?:probability|risk|score|confidence|chance))/gi, unit: 'prob' },
];

export function normalizeUnit(unit) {
  const clean = unit.toLowerCase().replace(/\s|°|\//g, '');
  if (clean === 'c' || clean.startsWith('deg') || clean === 'celsius') return 'c';
  if (clean === 'kmh' || clean === 'kph' || clean.includes('perhour') || clean.includes('km/h')) return 'kmh';
  if (clean === 'km' || clean.startsWith('kilo')) return 'km';
  if (clean === 'mm' || clean.startsWith('milli')) return 'mm';
  if (clean === '%' || clean.startsWith('percent')) return '%';
  if (clean === 'prob') return 'prob';
  return clean;
}

export function measurementKeys(text) {
  const keys = [];
  const str = String(text || '');
  for (const { regex, unit } of MEASUREMENT_PATTERNS) {
    for (const match of str.matchAll(regex)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        keys.push({ key: `${value.toFixed(1)}:${unit}`, value, unit });
        if (unit === '%') {
          // Cross-map percentage to probability fraction (e.g. 78% -> 0.78:prob)
          const probVal = value / 100;
          keys.push({ key: `${probVal.toFixed(2)}:prob`, value: probVal, unit: 'prob' });
        } else if (unit === 'prob') {
          // Cross-map probability fraction to percentage (e.g. 0.78 -> 78.0:%)
          const pctVal = value * 100;
          keys.push({ key: `${pctVal.toFixed(1)}:%`, value: pctVal, unit: '%' });
        }
      }
    }
  }
  return keys;
}

function extractStructuredMeasurements(obj, targetSet) {
  if (!obj || typeof obj !== 'object') return;

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      const keyLower = k.toLowerCase();
      // Temperature
      if (keyLower.includes('temp')) {
        targetSet.add(`${v.toFixed(1)}:c`);
        targetSet.add(`${Math.round(v).toFixed(1)}:c`);
      }
      // Humidity / Probability / Percentages
      if (keyLower.includes('humidity') || keyLower.includes('prob') || keyLower.includes('chance')) {
        targetSet.add(`${v.toFixed(1)}:%`);
        targetSet.add(`${Math.round(v).toFixed(1)}:%`);
        const frac = v > 1 ? v / 100 : v;
        targetSet.add(`${frac.toFixed(2)}:prob`);
      }
      // Risk scores (0 to 1 -> 0% to 100%)
      if (keyLower === 'score' || keyLower.includes('riskvalue') || keyLower === 'relevance' || keyLower === 'locationconfidence') {
        const pct = v <= 1 ? v * 100 : v;
        const frac = v <= 1 ? v : v / 100;
        targetSet.add(`${pct.toFixed(1)}:%`);
        targetSet.add(`${Math.round(pct).toFixed(1)}:%`);
        targetSet.add(`${frac.toFixed(2)}:prob`);
      }
      // Precipitation
      if (keyLower.includes('precip') || keyLower.includes('rain') || keyLower.includes('amount')) {
        targetSet.add(`${v.toFixed(1)}:mm`);
        targetSet.add(`${Math.round(v).toFixed(1)}:mm`);
      }
      // Wind speed
      if (keyLower.includes('wind')) {
        targetSet.add(`${v.toFixed(1)}:kmh`);
        targetSet.add(`${Math.round(v).toFixed(1)}:kmh`);
      }
      // Distance
      if (keyLower.includes('dist') || keyLower === 'distancekm') {
        targetSet.add(`${v.toFixed(1)}:km`);
        targetSet.add(`${Math.round(v).toFixed(1)}:km`);
      }
    } else if (typeof v === 'object' && v !== null) {
      extractStructuredMeasurements(v, targetSet);
    }
  }
}

export function validateGroundedMeasurements(responseText, context) {
  const allowed = new Set(measurementKeys(JSON.stringify(context)).map((m) => m.key));
  extractStructuredMeasurements(context, allowed);

  const claimed = measurementKeys(responseText);
  const ungrounded = claimed.filter(({ key, value, unit }) => {
    if (allowed.has(key)) return false;
    // Allow integer rounding variations
    const intKey = `${Math.round(value).toFixed(1)}:${unit}`;
    if (allowed.has(intKey)) return false;
    // Allow decimal precision variations for probability
    if (unit === 'prob') {
      const altKey = `${value.toFixed(2)}:prob`;
      if (allowed.has(altKey)) return false;
    }
    return true;
  }).map((m) => m.key);

  return { grounded: ungrounded.length === 0, ungrounded };
}
