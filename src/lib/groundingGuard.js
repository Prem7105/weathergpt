const MEASUREMENT_PATTERN = /(-?\d+(?:\.\d+)?)\s*(°?\s*C|%|mm|km\s*\/?\s*h|km\b)/gi;

function normalizeUnit(unit) {
  const clean = unit.toLowerCase().replace(/\s|°|\//g, '');
  if (clean === 'c') return 'c';
  if (clean === 'kmh') return 'kmh';
  if (clean === 'km') return 'km';
  if (clean === 'mm') return 'mm';
  if (clean === '%') return '%';
  return clean;
}

function measurementKeys(text) {
  return [...String(text || '').matchAll(MEASUREMENT_PATTERN)].map((match) => {
    const value = Number(match[1]);
    const unit = normalizeUnit(match[2]);
    return { key: `${value.toFixed(1)}:${unit}`, value, unit };
  });
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
      }
      // Risk scores (0 to 1 -> 0% to 100%)
      if (keyLower === 'score' || keyLower.includes('riskvalue') || keyLower === 'relevance' || keyLower === 'locationconfidence') {
        const pct = v * 100;
        targetSet.add(`${pct.toFixed(1)}:%`);
        targetSet.add(`${Math.round(pct).toFixed(1)}:%`);
      }
      // Precipitation
      if (keyLower.includes('precip') || keyLower.includes('rain')) {
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
    // Allow small integer rounding differences (e.g. 28.0 vs 28)
    const intKey = `${Math.round(value).toFixed(1)}:${unit}`;
    if (allowed.has(intKey)) return false;
    return true;
  }).map((m) => m.key);

  return { grounded: ungrounded.length === 0, ungrounded };
}
