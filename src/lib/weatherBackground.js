// Condition text is free-form (Open-Meteo / OpenWeatherMap phrasing), so match on keywords.
export function iconForCondition(condition) {
  const c = String(condition ?? '').toLowerCase();
  if (/thunder|storm|lightning/.test(c)) return 'storm';
  if (/snow|sleet|blizzard/.test(c)) return 'snow';
  if (/fog|mist|haze|smoke|dust/.test(c)) return 'fog';
  if (/rain|drizzle|shower/.test(c)) return 'rain';
  if (/overcast|cloudy/.test(c)) return 'cloud';
  if (/partly|mainly clear|few clouds|scattered/.test(c)) return 'cloud-sun';
  if (/clear|sunny/.test(c)) return 'clear';
  return 'cloud-sun';
}

function unsplash(id) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1920&q=75`;
}

// tint is "r,g,b" for the legibility scrim so it reads as the condition's atmosphere.
const DAY = {
  clear: { image: unsplash('1601297183305-6df142704ea2'), tint: '40,30,14', particle: 'none' },
  'cloud-sun': { image: unsplash('1525490829609-d166ddb58678'), tint: '28,30,38', particle: 'none' },
  cloud: { image: unsplash('1501630834273-4b5604d2ee31'), tint: '22,26,34', particle: 'none' },
  fog: { image: unsplash('1573669004223-af922fd838df'), tint: '30,32,36', particle: 'fog' },
  rain: { image: unsplash('1784751449592-43f09159b621'), tint: '10,16,28', particle: 'rain' },
  storm: { image: unsplash('1500674425229-f692875b0ab7'), tint: '12,12,22', particle: 'rain' },
  snow: { image: unsplash('1483921020237-2ff51e8e4b22'), tint: '22,28,38', particle: 'snow' },
};

const NIGHT_IMAGE = {
  clear: unsplash('1472552944129-b035e9ea3744'),
  'cloud-sun': unsplash('1472552944129-b035e9ea3744'),
};

export function getBackground(icon, isDay) {
  const base = DAY[icon] ?? DAY.cloud;
  if (isDay !== false) return base;
  return { image: NIGHT_IMAGE[icon] ?? base.image, tint: '6,8,16', particle: base.particle };
}
