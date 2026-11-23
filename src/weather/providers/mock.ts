/**
 * Sample-data provider: the five cities from the Nimbus design, with fixed local
 * times. Works offline. Use it for design work, demos and tests
 * (VITE_WEATHER_PROVIDER=mock or ?provider=mock).
 */
import type { Condition } from '../../design-system';
import { DEFAULT_PLACES, matchesPlace } from '../places';
import type { Forecast, Place, PressureTrend, WeatherAlert } from '../types';
import { WeatherProviderError, type WeatherProvider } from './types';

type Day = [label: string, condition: Condition, min: number, max: number, pop: number];

interface Sample {
  now: string; // local
  condition: Condition;
  label: string;
  isDay: boolean;
  temp: number;
  feels: number;
  /** Temperatures every 3 hours from now, 9 values. */
  temps3h: number[];
  icons3h: Condition[];
  pops3h: number[];
  days: Day[];
  wind: number;
  windDeg: number;
  gust: number;
  uv: number;
  humidity: number;
  dew: number;
  sunrise: string; // HH:mm
  sunset: string;
  aqi: number;
  pressure: number;
  trend: PressureTrend;
  vis: number;
  alerts?: WeatherAlert[];
}

const SAMPLES: Record<string, Sample> = {
  'geo:5391959': {
    now: '2026-11-23T14:41', condition: 'sun', label: 'Clear', isDay: true, temp: 18, feels: 17,
    temps3h: [18, 17, 14, 13, 12, 11, 12, 15, 18], icons3h: ['sun', 'sun', 'moon', 'moon', 'cloud', 'cloud', 'partly', 'sun', 'sun'], pops3h: [0, 0, 0, 0, 10, 10, 0, 0, 0],
    days: [['Mon', 'sun', 11, 19, 0], ['Tue', 'partly', 10, 18, 0], ['Wed', 'cloud', 11, 16, 10], ['Thu', 'rain', 10, 14, 70], ['Fri', 'rain', 9, 13, 60], ['Sat', 'partly', 9, 15, 20], ['Sun', 'sun', 10, 17, 0]],
    wind: 19, windDeg: 280, gust: 28, uv: 5, humidity: 58, dew: 9, sunrise: '07:01', sunset: '16:55', aqi: 32, pressure: 1018, trend: 'steady', vis: 16,
  },
  'geo:1850147': {
    now: '2026-11-24T07:41', condition: 'partly', label: 'Morning haze', isDay: true, temp: 9, feels: 7,
    temps3h: [9, 12, 15, 16, 13, 12, 11, 10, 9], icons3h: ['partly', 'sun', 'sun', 'sun', 'moon', 'moon', 'moon', 'cloud', 'partly'], pops3h: [0, 0, 0, 0, 0, 0, 0, 10, 10],
    days: [['Tue', 'partly', 8, 16, 0], ['Wed', 'sun', 9, 17, 0], ['Thu', 'cloud', 10, 15, 20], ['Fri', 'rain', 11, 14, 80], ['Sat', 'partly', 8, 15, 10], ['Sun', 'sun', 7, 14, 0], ['Mon', 'sun', 7, 15, 0]],
    wind: 9, windDeg: 350, gust: 15, uv: 3, humidity: 71, dew: 4, sunrise: '06:24', sunset: '16:30', aqi: 41, pressure: 1022, trend: 'rising', vis: 9,
  },
  'geo:2147714': {
    now: '2026-11-24T09:41', condition: 'sun', label: 'Sunny', isDay: true, temp: 24, feels: 25,
    temps3h: [24, 27, 28, 26, 23, 21, 20, 19, 22], icons3h: ['sun', 'sun', 'sun', 'partly', 'moon', 'moon', 'moon', 'partly', 'sun'], pops3h: [0, 0, 0, 10, 10, 0, 0, 0, 0],
    days: [['Tue', 'sun', 19, 28, 0], ['Wed', 'sun', 20, 31, 0], ['Thu', 'storm', 21, 27, 60], ['Fri', 'partly', 18, 24, 20], ['Sat', 'sun', 18, 25, 0], ['Sun', 'sun', 19, 27, 0], ['Mon', 'partly', 20, 26, 10]],
    wind: 22, windDeg: 120, gust: 31, uv: 9, humidity: 54, dew: 14, sunrise: '05:43', sunset: '19:46', aqi: 22, pressure: 1014, trend: 'falling', vis: 20,
  },
  'geo:2643743': {
    now: '2026-11-23T22:41', condition: 'rain', label: 'Heavy rain', isDay: false, temp: 8, feels: 4,
    temps3h: [8, 7, 7, 6, 8, 10, 9, 8, 7], icons3h: ['rain', 'rain', 'rain', 'rain', 'cloud', 'partly', 'cloud', 'cloud', 'cloud'], pops3h: [90, 85, 70, 55, 30, 20, 25, 30, 35],
    days: [['Mon', 'rain', 6, 11, 90], ['Tue', 'cloud', 5, 10, 40], ['Wed', 'partly', 3, 9, 10], ['Thu', 'rain', 6, 12, 70], ['Fri', 'rain', 7, 12, 80], ['Sat', 'cloud', 5, 10, 30], ['Sun', 'partly', 3, 8, 10]],
    wind: 34, windDeg: 225, gust: 58, uv: 0, humidity: 94, dew: 7, sunrise: '07:32', sunset: '16:00', aqi: 18, pressure: 996, trend: 'falling', vis: 4,
    alerts: [{ title: 'Yellow rain warning', description: 'Until 6 AM. Expect surface water and spray on roads.', severity: 'moderate', ends: '2026-11-24T06:00' }],
  },
  'geo:3413829': {
    now: '2026-11-23T22:41', condition: 'snow', label: 'Light snow', isDay: false, temp: -2, feels: -8,
    temps3h: [-2, -3, -4, -4, -2, 0, -1, -2, -3], icons3h: ['snow', 'moon', 'moon', 'cloud', 'snow', 'partly', 'cloud', 'snow', 'snow'], pops3h: [60, 20, 10, 30, 50, 20, 30, 55, 60],
    days: [['Mon', 'snow', -4, 1, 70], ['Tue', 'partly', -5, 0, 20], ['Wed', 'cloud', -3, 2, 30], ['Thu', 'snow', -2, 1, 80], ['Fri', 'snow', -4, -1, 60], ['Sat', 'sun', -7, -2, 0], ['Sun', 'partly', -6, -1, 10]],
    wind: 28, windDeg: 30, gust: 44, uv: 0, humidity: 82, dew: -5, sunrise: '10:18', sunset: '16:12', aqi: 12, pressure: 1006, trend: 'rising', vis: 6,
    alerts: [{ title: 'Aurora forecast: Kp 5', description: 'Strong activity likely in clear breaks, 11 PM to 2 AM.', severity: 'minor' }],
  },
};

const LABELS: Record<Condition, string> = { sun: 'Sunny', moon: 'Clear', cloud: 'Cloudy', partly: 'Partly cloudy', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm', aurora: 'Clear' };

function addHours(localIso: string, hours: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(localIso)!;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + hours));
  return d.toISOString().slice(0, 13) + ':00';
}
function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

export function buildSampleForecast(place: Place, s: Sample, fetchedAt: string): Forecast {
  const today = s.now.slice(0, 10);
  const hourly = Array.from({ length: 25 }, (_, h) => {
    const k = Math.min(Math.floor(h / 3), 7);
    const f = (h - k * 3) / 3;
    const temp = s.temps3h[k] + (s.temps3h[k + 1] - s.temps3h[k]) * f;
    const icon = s.icons3h[Math.round(h / 3)] ?? s.icons3h[8];
    return {
      time: h === 0 ? s.now : addHours(s.now, h),
      tempC: Math.round(temp * 10) / 10,
      condition: icon,
      conditionLabel: LABELS[icon],
      isDay: icon !== 'moon',
      precipProbability: s.pops3h[Math.round(h / 3)] ?? 0,
    };
  });
  return {
    place,
    timezone: place.timezone ?? 'UTC',
    fetchedAt,
    current: {
      time: s.now, tempC: s.temp, feelsLikeC: s.feels, condition: s.condition, conditionLabel: s.label, isDay: s.isDay,
      humidity: s.humidity, dewPointC: s.dew, windKmh: s.wind, windGustKmh: s.gust, windDirectionDeg: s.windDeg,
      pressureHpa: s.pressure, pressureTrend: s.trend, visibilityKm: s.vis, uvIndex: s.uv, aqi: s.aqi,
    },
    hourly,
    daily: s.days.map(([, condition, min, max, pop], i) => {
      const date = addDays(today, i);
      return { date, condition, conditionLabel: LABELS[condition], minC: min, maxC: max, precipProbability: pop, sunrise: `${date}T${s.sunrise}`, sunset: `${date}T${s.sunset}`, uvIndexMax: i === 0 ? Math.max(s.uv, 1) : 3 };
    }),
    alerts: s.alerts ?? [],
    source: { name: 'Nimbus sample data' },
    isSample: true,
  };
}

export function createMockProvider({ delayMs = 250 }: { delayMs?: number } = {}): WeatherProvider {
  const wait = (signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, delayMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  return {
    id: 'mock',
    name: 'Nimbus sample data',
    async getForecast(place, options) {
      await wait(options?.signal);
      const sample = SAMPLES[place.id];
      if (!sample) throw new WeatherProviderError('not-found', `Sample data only covers the five starter cities, not ${place.name}.`);
      return buildSampleForecast(place, sample, new Date().toISOString());
    },
    async searchPlaces(query, options) {
      await wait(options?.signal);
      return DEFAULT_PLACES.filter((p) => matchesPlace(p, query));
    },
  };
}
