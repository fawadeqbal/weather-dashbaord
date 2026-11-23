/**
 * Open-Meteo adapter. Free, no API key, CORS-enabled, so the browser can call it
 * directly. Docs: https://open-meteo.com/en/docs
 *
 * Three endpoints:
 *   forecast     api.open-meteo.com/v1/forecast
 *   air quality  air-quality-api.open-meteo.com/v1/air-quality   (optional; failure → aqi null)
 *   geocoding    geocoding-api.open-meteo.com/v1/search
 */
import { fromWmoCode } from '../conditions';
import type { Forecast, HourlyWeather, Place, PressureTrend } from '../types';
import { fetchJson, WeatherProviderError, type WeatherProvider } from './types';

export const OPEN_METEO_URLS = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
};

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility,uv_index';
const HOURLY = 'temperature_2m,weather_code,precipitation_probability,is_day,pressure_msl';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max';

/** Raw response shapes (only the fields we request). */
export interface OpenMeteoForecast {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    dew_point_2m: number;
    is_day: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    pressure_msl: number;
    visibility: number | null;
    uv_index: number | null;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: Array<number | null>;
    is_day: number[];
    pressure_msl: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: Array<number | null>;
    sunrise: string[];
    sunset: string[];
    uv_index_max: Array<number | null>;
  };
}

export interface OpenMeteoAirQuality {
  current?: { time: string; us_aqi: number | null };
}

export interface OpenMeteoGeocoding {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
    feature_code?: string;
  }>;
}

export function forecastUrl(place: Pick<Place, 'latitude' | 'longitude'>): string {
  const q = new URLSearchParams({
    latitude: place.latitude.toFixed(4),
    longitude: place.longitude.toFixed(4),
    current: CURRENT,
    hourly: HOURLY,
    daily: DAILY,
    timezone: 'auto',
    forecast_days: '7',
    forecast_hours: '25',
    wind_speed_unit: 'kmh',
  });
  return `${OPEN_METEO_URLS.forecast}?${q}`;
}

export function airQualityUrl(place: Pick<Place, 'latitude' | 'longitude'>): string {
  const q = new URLSearchParams({ latitude: place.latitude.toFixed(4), longitude: place.longitude.toFixed(4), current: 'us_aqi', timezone: 'auto' });
  return `${OPEN_METEO_URLS.airQuality}?${q}`;
}

export function geocodingUrl(query: string): string {
  const q = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' });
  return `${OPEN_METEO_URLS.geocoding}?${q}`;
}

function pressureTrend(series: number[], from: number): PressureTrend {
  const a = series[from];
  const b = series[Math.min(from + 3, series.length - 1)];
  if (a == null || b == null) return 'steady';
  if (b - a > 1) return 'rising';
  if (a - b > 1) return 'falling';
  return 'steady';
}

/** Pure mapping from Open-Meteo responses to the app's Forecast. Unit-tested with real fixtures. */
export function mapOpenMeteo(place: Place, fc: OpenMeteoForecast, air: OpenMeteoAirQuality | null, fetchedAt: string): Forecast {
  const c = fc.current;
  const isDay = c.is_day === 1;
  const now = fromWmoCode(c.weather_code, isDay);

  // Hourly series start at the current hour; find it in case the API returned earlier hours.
  const currentHour = c.time.slice(0, 13);
  let start = fc.hourly.time.findIndex((t) => t.slice(0, 13) >= currentHour);
  if (start < 0) start = 0;

  const hourly: HourlyWeather[] = fc.hourly.time.slice(start).map((time, k) => {
    const i = start + k;
    const day = fc.hourly.is_day[i] === 1;
    const w = fromWmoCode(fc.hourly.weather_code[i], day);
    return {
      time,
      tempC: fc.hourly.temperature_2m[i],
      condition: w.condition,
      conditionLabel: w.label,
      isDay: day,
      precipProbability: fc.hourly.precipitation_probability[i] ?? null,
    };
  });

  const daily = fc.daily.time.map((date, i) => {
    const w = fromWmoCode(fc.daily.weather_code[i], true);
    return {
      date,
      condition: w.condition,
      conditionLabel: w.label,
      minC: fc.daily.temperature_2m_min[i],
      maxC: fc.daily.temperature_2m_max[i],
      precipProbability: fc.daily.precipitation_probability_max[i] ?? null,
      sunrise: fc.daily.sunrise[i] ?? null,
      sunset: fc.daily.sunset[i] ?? null,
      uvIndexMax: fc.daily.uv_index_max[i] ?? null,
    };
  });

  return {
    place: { ...place, timezone: fc.timezone },
    timezone: fc.timezone,
    fetchedAt,
    current: {
      time: c.time,
      tempC: c.temperature_2m,
      feelsLikeC: c.apparent_temperature,
      condition: now.condition,
      conditionLabel: now.label,
      isDay,
      code: c.weather_code,
      humidity: c.relative_humidity_2m,
      dewPointC: c.dew_point_2m,
      windKmh: c.wind_speed_10m,
      windGustKmh: c.wind_gusts_10m,
      windDirectionDeg: c.wind_direction_10m,
      pressureHpa: c.pressure_msl,
      pressureTrend: pressureTrend(fc.hourly.pressure_msl, start),
      visibilityKm: c.visibility == null ? null : c.visibility / 1000,
      uvIndex: c.uv_index ?? null,
      aqi: air?.current?.us_aqi ?? null,
    },
    hourly,
    daily,
    // Open-Meteo has no official warnings feed. A provider that does (national
    // services, WeatherAPI.com, OpenWeatherMap One Call) fills this list.
    alerts: [],
    source: { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  };
}

export function mapGeocoding(body: OpenMeteoGeocoding): Place[] {
  return (body.results ?? []).map((r) => ({
    id: `geo:${r.id}`,
    name: r.name,
    country: r.country ?? '',
    region: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

export function createOpenMeteoProvider(): WeatherProvider {
  return {
    id: 'open-meteo',
    name: 'Open-Meteo',
    async getForecast(place, options) {
      const signal = options?.signal;
      const [fc, air] = await Promise.all([
        fetchJson<OpenMeteoForecast>(forecastUrl(place), signal),
        // Air quality is a nice-to-have: never fail the forecast because of it.
        fetchJson<OpenMeteoAirQuality>(airQualityUrl(place), signal).catch((err) => {
          if ((err as Error)?.name === 'AbortError') throw err;
          return null;
        }),
      ]);
      if (!fc?.current || !fc.hourly || !fc.daily) {
        throw new WeatherProviderError('parse', 'The forecast was missing current, hourly or daily data.');
      }
      return mapOpenMeteo(place, fc, air, new Date().toISOString());
    },
    async searchPlaces(query, options) {
      const q = query.trim();
      if (q.length < 2) return [];
      return mapGeocoding(await fetchJson<OpenMeteoGeocoding>(geocodingUrl(q), options?.signal));
    },
  };
}
