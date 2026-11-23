/** Words for weather values: compass points, UV, air quality, wind force, comfort. */

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

export const AQI_BANDS = [
  { max: 50, label: 'Good', note: 'Little or no risk.' },
  { max: 100, label: 'Moderate', note: 'Acceptable; unusually sensitive people may notice it.' },
  { max: 150, label: 'Unhealthy for some', note: 'Children, older adults and people with lung disease should take it easy.' },
  { max: 200, label: 'Unhealthy', note: 'Everyone may begin to feel effects.' },
  { max: 300, label: 'Very unhealthy', note: 'Health alert: avoid long or heavy exertion outdoors.' },
  { max: 500, label: 'Hazardous', note: 'Stay indoors with windows closed.' },
];

/** Beaufort scale description for a wind speed in km/h. */
export function windForce(kmh: number): { force: number; label: string } {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const labels = ['Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane force'];
  const force = limits.findIndex((l) => kmh < l);
  const f = force === -1 ? 12 : force;
  return { force: f, label: labels[f] };
}

export function humidityComfort(dewPointC: number): string {
  if (dewPointC < 10) return 'Dry and comfortable.';
  if (dewPointC < 16) return 'Comfortable.';
  if (dewPointC < 19) return 'Slightly humid.';
  if (dewPointC < 22) return 'Humid. Most people feel it.';
  return 'Oppressive. Take it easy outdoors.';
}

export function visibilityLabel(km: number): string {
  if (km < 1) return 'Fog. Very poor visibility.';
  if (km < 4) return 'Poor visibility.';
  if (km < 10) return 'Moderate visibility.';
  if (km < 20) return 'Good visibility.';
  return 'Excellent visibility.';
}

export function feelsLikeNote(tempC: number, feelsC: number): string {
  const d = feelsC - tempC;
  if (d <= -3) return 'Wind makes it feel colder than it is.';
  if (d >= 3) return 'Humidity makes it feel warmer than it is.';
  return 'Close to the actual temperature.';
}
