/**
 * Sample-data provider: the five starter cities with fixed local times and
 * seven days of generated hourly data. Works offline. Use it for design work,
 * demos and tests (VITE_WEATHER_PROVIDER=mock or ?provider=mock).
 */
import type { Condition } from '../../design-system';
import { DEFAULT_PLACES, matchesPlace } from '../places';
import type { DailyWeather, Forecast, HourlyWeather, Place, PressureTrend, WeatherAlert } from '../types';
import { WeatherProviderError, type WeatherProvider } from './types';

type Day = [condition: Condition, min: number, max: number, pop: number, precipMm: number];

export interface Sample {
  now: string; // local
  condition: Condition;
  label: string;
  isDay: boolean;
  temp: number;
  feels: number;
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
  /** Europe gets pollen data. */
  europe?: boolean;
  alerts?: WeatherAlert[];
}

export const SAMPLES: Record<string, Sample> = {
  'geo:5391959': {
    now: '2026-11-23T14:41', condition: 'sun', label: 'Clear', isDay: true, temp: 18, feels: 17,
    days: [['sun', 11, 19, 0, 0], ['partly', 10, 18, 0, 0], ['cloud', 11, 16, 10, 0], ['rain', 10, 14, 70, 6.2], ['rain', 9, 13, 60, 3.1], ['partly', 9, 15, 20, 0.2], ['sun', 10, 17, 0, 0]],
    wind: 19, windDeg: 280, gust: 28, uv: 5, humidity: 58, dew: 9, sunrise: '07:01', sunset: '16:55', aqi: 32, pressure: 1018, trend: 'steady', vis: 16,
  },
  'geo:1850147': {
    now: '2026-11-24T07:41', condition: 'partly', label: 'Morning haze', isDay: true, temp: 9, feels: 7,
    days: [['partly', 8, 16, 0, 0], ['sun', 9, 17, 0, 0], ['cloud', 10, 15, 20, 0.4], ['rain', 11, 14, 80, 12.5], ['partly', 8, 15, 10, 0], ['sun', 7, 14, 0, 0], ['sun', 7, 15, 0, 0]],
    wind: 9, windDeg: 350, gust: 15, uv: 3, humidity: 71, dew: 4, sunrise: '06:24', sunset: '16:30', aqi: 41, pressure: 1022, trend: 'rising', vis: 9,
  },
  'geo:2147714': {
    now: '2026-11-24T09:41', condition: 'sun', label: 'Sunny', isDay: true, temp: 24, feels: 25,
    days: [['sun', 19, 28, 0, 0], ['sun', 20, 31, 0, 0], ['storm', 21, 27, 60, 9.8], ['partly', 18, 24, 20, 0.6], ['sun', 18, 25, 0, 0], ['sun', 19, 27, 0, 0], ['partly', 20, 26, 10, 0]],
    wind: 22, windDeg: 120, gust: 31, uv: 9, humidity: 54, dew: 14, sunrise: '05:43', sunset: '19:46', aqi: 22, pressure: 1014, trend: 'falling', vis: 20,
  },
  'geo:2643743': {
    now: '2026-11-23T22:41', condition: 'rain', label: 'Heavy rain', isDay: false, temp: 8, feels: 4,
    days: [['rain', 6, 11, 90, 14.2], ['cloud', 5, 10, 40, 1.2], ['partly', 3, 9, 10, 0], ['rain', 6, 12, 70, 5.5], ['rain', 7, 12, 80, 8.1], ['cloud', 5, 10, 30, 0.5], ['partly', 3, 8, 10, 0]],
    wind: 34, windDeg: 225, gust: 58, uv: 0, humidity: 94, dew: 7, sunrise: '07:32', sunset: '16:00', aqi: 18, pressure: 996, trend: 'falling', vis: 4, europe: true,
    alerts: [{ title: 'Yellow rain warning', description: 'Until 6 AM. Expect surface water and spray on roads.', severity: 'moderate', ends: '2026-11-24T06:00' }],
  },
  'geo:3413829': {
    now: '2026-11-23T22:41', condition: 'snow', label: 'Light snow', isDay: false, temp: -2, feels: -8,
    days: [['snow', -4, 1, 70, 3.4], ['partly', -5, 0, 20, 0], ['cloud', -3, 2, 30, 0.3], ['snow', -2, 1, 80, 6.1], ['snow', -4, -1, 60, 2.2], ['sun', -7, -2, 0, 0], ['partly', -6, -1, 10, 0]],
    wind: 28, windDeg: 30, gust: 44, uv: 0, humidity: 82, dew: -5, sunrise: '10:18', sunset: '16:12', aqi: 12, pressure: 1006, trend: 'rising', vis: 6, europe: true,
    alerts: [{ title: 'Aurora forecast: Kp 5', description: 'Strong activity likely in clear breaks, 11 PM to 2 AM.', severity: 'minor' }],
  },
};

function cloudFor(c: Condition, wave: number): number {
  const base = c === 'sun' || c === 'moon' ? 12 : c === 'partly' ? 45 : c === 'cloud' ? 85 : 95;
  return Math.max(0, Math.min(100, Math.round(base + wave * 8)));
}

const LABELS: Record<Condition, string> = { sun: 'Sunny', moon: 'Clear', cloud: 'Cloudy', partly: 'Partly cloudy', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm', aurora: 'Clear' };

function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}
const minutesOf = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildSampleForecast(place: Place, s: Sample, fetchedAt: string): Forecast {
  const today = s.now.slice(0, 10);
  const nowHour = +s.now.slice(11, 13);
  const rise = minutesOf(s.sunrise);
  const set = minutesOf(s.sunset);

  const hourly: HourlyWeather[] = [];
  s.days.forEach(([cond, min, max, pop, mm], d) => {
    const date = addDays(today, d);
    const uvMax = d === 0 ? Math.max(s.uv, 1) : cond === 'sun' ? s.uv + 1 : Math.max(1, s.uv - 1);
    for (let h = 0; h < 24; h++) {
      const minute = h * 60 + 30;
      const day = minute > rise && minute < set;
      // Coolest near 5 AM, warmest near 3 PM.
      const temp = min + (max - min) * (0.5 + 0.5 * Math.cos((2 * Math.PI * (h - 15)) / 24));
      const isNow = d === 0 && h === nowHour;
      const condition: Condition = isNow ? s.condition : !day && cond === 'sun' ? 'moon' : !day && cond === 'partly' ? 'cloud' : cond;
      const wave = Math.sin((h + d * 5) / 3);
      const uv = day ? Math.max(0, uvMax * Math.sin((Math.PI * (minute - rise)) / (set - rise))) : 0;
      hourly.push({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        tempC: isNow ? s.temp : round1(temp),
        feelsLikeC: isNow ? s.feels : round1(temp + (s.feels - s.temp)),
        condition,
        conditionLabel: isNow ? s.label : LABELS[condition],
        isDay: day,
        precipProbability: pop ? Math.max(0, Math.min(100, Math.round(pop + wave * 15))) : 0,
        precipMm: mm ? round1(Math.max(0, (mm / 12) * (1 + wave))) : 0,
        humidity: Math.round(Math.max(20, Math.min(100, s.humidity - (temp - min) * 2 + wave * 4))),
        dewPointC: round1(s.dew + wave),
        windKmh: Math.round(Math.max(2, s.wind * (0.8 + 0.3 * wave))),
        windGustKmh: Math.round(Math.max(4, s.gust * (0.8 + 0.3 * wave))),
        windDirectionDeg: Math.round((s.windDeg + wave * 25 + 360) % 360),
        pressureHpa: round1(s.pressure + (s.trend === 'rising' ? 1 : s.trend === 'falling' ? -1 : 0) * ((d * 24 + h - nowHour) / 12)),
        uvIndex: round1(uv),
        visibilityKm: round1(Math.max(1, s.vis + wave * 2)),
        aqi: d < 5 ? Math.max(5, Math.round(s.aqi + wave * 8)) : null,
        uvClearSky: round1(uv * 1.15),
        cloudCover: cloudFor(condition, wave),
        cloudLow: condition === 'rain' || condition === 'storm' || condition === 'snow' ? Math.round(70 + wave * 20) : condition === 'cloud' ? Math.round(45 + wave * 15) : 0,
        cloudMid: condition === 'partly' || condition === 'cloud' ? Math.round(30 + wave * 10) : condition === 'rain' ? 60 : 4,
        cloudHigh: condition === 'sun' || condition === 'moon' ? Math.round(15 + wave * 5) : 40,
        rainMm: cond === 'snow' ? 0 : mm ? round1(Math.max(0, (mm / 12) * (1 + wave) * 0.75)) : 0,
        showersMm: cond === 'snow' ? 0 : mm ? round1(Math.max(0, (mm / 12) * (1 + wave) * 0.25)) : 0,
        snowfallCm: cond === 'snow' && mm ? round1(Math.max(0, (mm / 12) * (1 + wave) * 0.7)) : 0,
        wind80Kmh: Math.round(Math.max(3, s.wind * (0.8 + 0.3 * wave) * 1.4)),
        wind120Kmh: Math.round(Math.max(3, s.wind * (0.8 + 0.3 * wave) * 1.6)),
        wind180Kmh: Math.round(Math.max(3, s.wind * (0.8 + 0.3 * wave) * 1.8)),
      });
    }
  });

  const daily: DailyWeather[] = s.days.map(([condition, min, max, pop, mm], i) => {
    const date = addDays(today, i);
    const daylightSec = (set - rise - i) * 60;
    const sunny = condition === 'sun' ? 0.85 : condition === 'partly' ? 0.6 : condition === 'cloud' ? 0.25 : 0.1;
    return {
      date, condition, conditionLabel: LABELS[condition], minC: min, maxC: max, precipProbability: pop, precipSumMm: mm,
      windMaxKmh: Math.round(s.wind * 1.2), sunrise: `${date}T${s.sunrise}`, sunset: `${date}T${s.sunset}`,
      uvIndexMax: Math.round(Math.max(...hourly.filter((h) => h.time.startsWith(date)).map((h) => h.uvIndex ?? 0)) * 10) / 10,
      sunshineSec: Math.round(daylightSec * sunny),
      daylightSec,
      precipHours: mm ? Math.min(24, Math.round(mm * 1.3)) : 0,
      rainSumMm: condition === 'snow' ? 0 : round1(mm * 0.75),
      showersSumMm: condition === 'snow' ? 0 : round1(mm * 0.25),
      snowfallSumCm: condition === 'snow' ? round1(mm * 0.7) : 0,
      gustMaxKmh: Math.round(s.gust * 1.1),
      windDirDominantDeg: s.windDeg,
    };
  });

  // 15-minute rain for the next 3 hours, easing off when it's raining now.
  const wetNow = s.condition === 'rain' || s.condition === 'storm' || s.condition === 'snow';
  const nowMin = +s.now.slice(11, 13) * 60 + +s.now.slice(14, 16);
  const start = Math.floor(nowMin / 15) * 15;
  const minutely15 = Array.from({ length: 12 }, (_, k) => {
    const m = start + k * 15;
    const extraDays = Math.floor(m / 1440);
    const mm2 = m % 1440;
    const date = addDays(today, extraDays);
    return {
      time: `${date}T${String(Math.floor(mm2 / 60)).padStart(2, '0')}:${String(mm2 % 60).padStart(2, '0')}`,
      precipMm: wetNow ? Math.round(Math.max(0, 1.2 - k * 0.08) * 100) / 100 : 0,
    };
  });

  return {
    place,
    timezone: place.timezone ?? 'UTC',
    fetchedAt,
    current: {
      time: s.now, tempC: s.temp, feelsLikeC: s.feels, condition: s.condition, conditionLabel: s.label, isDay: s.isDay,
      humidity: s.humidity, dewPointC: s.dew, windKmh: s.wind, windGustKmh: s.gust, windDirectionDeg: s.windDeg,
      pressureHpa: s.pressure, pressureTrend: s.trend, visibilityKm: s.vis, uvIndex: s.uv, precipMm: s.condition === 'rain' ? 1.4 : 0, aqi: s.aqi,
      euAqi: Math.round(s.aqi * 0.7),
      pollutants: { pm25: round1(s.aqi / 5), pm10: round1(s.aqi / 3), o3: Math.round(s.aqi * 1.6), no2: Math.round(s.aqi / 3), so2: 1, co: 180 },
      // Pollen data only exists for Europe (as with Open-Meteo).
      pollen: s.europe ? { alder: 0, birch: 0, grass: 2, mugwort: 0, olive: 0, ragweed: 0 } : null,
    },
    hourly,
    daily,
    minutely15,
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
    async getOutlook(place, options) {
      await wait(options?.signal);
      const sample = SAMPLES[place.id];
      if (!sample) throw new WeatherProviderError('not-found', `Sample data only covers the five starter cities, not ${place.name}.`);
      const week = buildSampleForecast(place, sample, new Date().toISOString()).daily;
      // Days 8–16 repeat the week's pattern with a gentle warming trend.
      const extra = Array.from({ length: 9 }, (_, k) => {
        const src = week[(k + 2) % week.length];
        const shift = Math.round(k / 3);
        return { ...src, date: addDays(week[week.length - 1].date, k + 1), minC: src.minC + shift, maxC: src.maxC + shift };
      });
      return [...week, ...extra];
    },
    async searchPlaces(query, options) {
      await wait(options?.signal);
      return DEFAULT_PLACES.filter((p) => matchesPlace(p, query));
    },
  };
}
