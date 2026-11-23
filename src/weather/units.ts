import type { Unit } from '../design-system';

export type { Unit };

export const toUnitTemp = (c: number, unit: Unit) => (unit === 'F' ? (c * 9) / 5 + 32 : c);

export function speed(kmh: number, unit: Unit): { value: number; unit: string } {
  return unit === 'F' ? { value: Math.round(kmh * 0.621371), unit: 'mph' } : { value: Math.round(kmh), unit: 'km/h' };
}

export function distance(km: number, unit: Unit): { value: number; unit: string } {
  const v = unit === 'F' ? km * 0.621371 : km;
  return { value: v >= 10 ? Math.round(v) : Math.round(v * 10) / 10, unit: unit === 'F' ? 'mi' : 'km' };
}

export function pressure(hpa: number, unit: Unit): { value: string; unit: string } {
  return unit === 'F' ? { value: (hpa * 0.02953).toFixed(2), unit: 'inHg' } : { value: String(Math.round(hpa)), unit: 'hPa' };
}

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const DIRECTION_WORDS: Record<string, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };

export function compassPoint(deg: number): string {
  return DIRECTIONS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** "from the west", "from the north-north-east" — for screen readers. */
export function compassWords(deg: number): string {
  return 'from the ' + compassPoint(deg).split('').map((ch) => DIRECTION_WORDS[ch]).join('-');
}

export function uvLabel(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

export function uvAdvice(uv: number): string {
  if (uv < 3) return 'No sun protection needed right now.';
  if (uv < 6) return 'Sunglasses and SPF if you are out at midday.';
  if (uv < 8) return 'Seek shade between 11 AM and 3 PM.';
  return 'Sunscreen essential. Limit midday sun.';
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for some';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

export function aqiAdvice(aqi: number): string {
  if (aqi <= 50) return 'Clean air. A good time to be outside.';
  if (aqi <= 100) return 'Fine for most people. Sensitive groups may want shorter outings.';
  if (aqi <= 150) return 'Sensitive groups should limit long outdoor activity.';
  return 'Limit time outdoors and keep windows closed.';
}
