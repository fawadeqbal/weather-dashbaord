/**
 * Open-Meteo adapter. Free, no API key, CORS-enabled, so the browser can call it
 * directly. Docs: https://open-meteo.com/en/docs
 *
 * Endpoints:
 *   forecast     api.open-meteo.com/v1/forecast              (7 days + yesterday, hourly, 15-minute rain)
 *   outlook      api.open-meteo.com/v1/forecast              (16 days, daily only, loaded on demand)
 *   air quality  air-quality-api.open-meteo.com/v1/air-quality (optional; failure → nulls)
 *   geocoding    geocoding-api.open-meteo.com/v1/search
 *
 * The forecast is requested with every extra field the detail screens use. If
 * Open-Meteo ever rejects that request (400), the adapter retries with the core
 * fields only, so the app keeps working and the extras just show as missing.
 */
import { fromWmoCode } from '../conditions';
import type { DailyWeather, Forecast, HourlyWeather, Place, Pollen, Pollutants, PressureTrend, QuarterHour } from '../types';
import { fetchJson, WeatherProviderError, type WeatherProvider } from './types';

export const OPEN_METEO_URLS = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
};

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility,uv_index,precipitation';
const HOURLY_CORE = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,precipitation_probability,precipitation,is_day,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility';
const HOURLY_EXTRA = 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,uv_index_clear_sky,rain,showers,snowfall,wind_speed_80m,wind_speed_120m,wind_speed_180m';
const DAILY_CORE = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max';
const DAILY_EXTRA = 'sunshine_duration,daylight_duration,precipitation_hours,rain_sum,showers_sum,snowfall_sum,wind_gusts_10m_max,wind_direction_10m_dominant';
const AIR_CURRENT = 'us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen';

type Series<T = number> = Array<T | null>;

/** Raw response shapes (only the fields we request; extras may be absent). */
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
    precipitation?: number | null;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: Series;
    relative_humidity_2m: Series;
    dew_point_2m: Series;
    weather_code: number[];
    precipitation_probability: Series;
    precipitation: Series;
    is_day: number[];
    pressure_msl: Series;
    wind_speed_10m: Series;
    wind_direction_10m: Series;
    wind_gusts_10m: Series;
    uv_index: Series;
    visibility: Series;
    cloud_cover?: Series;
    cloud_cover_low?: Series;
    cloud_cover_mid?: Series;
    cloud_cover_high?: Series;
    uv_index_clear_sky?: Series;
    rain?: Series;
    showers?: Series;
    snowfall?: Series;
    wind_speed_80m?: Series;
    wind_speed_120m?: Series;
    wind_speed_180m?: Series;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: Series;
    precipitation_sum: Series;
    sunrise: Series<string>;
    sunset: Series<string>;
    uv_index_max: Series;
    wind_speed_10m_max: Series;
    sunshine_duration?: Series;
    daylight_duration?: Series;
    precipitation_hours?: Series;
    rain_sum?: Series;
    showers_sum?: Series;
    snowfall_sum?: Series;
    wind_gusts_10m_max?: Series;
    wind_direction_10m_dominant?: Series;
  };
  minutely_15?: { time: string[]; precipitation: Series };
}

export interface OpenMeteoAirQuality {
  current?: {
    time: string;
    us_aqi: number | null;
    european_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
    ozone?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    carbon_monoxide?: number | null;
    alder_pollen?: number | null;
    birch_pollen?: number | null;
    grass_pollen?: number | null;
    mugwort_pollen?: number | null;
    olive_pollen?: number | null;
    ragweed_pollen?: number | null;
  };
  hourly?: { time: string[]; us_aqi: Series };
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

const coords = (p: Pick<Place, 'latitude' | 'longitude'>) => ({ latitude: p.latitude.toFixed(4), longitude: p.longitude.toFixed(4) });

/** The full forecast request. `extras: false` asks only for the core fields. */
export function forecastUrl(place: Pick<Place, 'latitude' | 'longitude'>, { extras = true }: { extras?: boolean } = {}): string {
  const q = new URLSearchParams({
    ...coords(place),
    current: CURRENT,
    hourly: extras ? `${HOURLY_CORE},${HOURLY_EXTRA}` : HOURLY_CORE,
    daily: extras ? `${DAILY_CORE},${DAILY_EXTRA}` : DAILY_CORE,
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });
  if (extras) {
    q.set('past_days', '1');
    q.set('minutely_15', 'precipitation');
    q.set('forecast_minutely_15', '8');
  }
  return `${OPEN_METEO_URLS.forecast}?${q}`;
}

export function outlookUrl(place: Pick<Place, 'latitude' | 'longitude'>): string {
  const q = new URLSearchParams({ ...coords(place), daily: DAILY_CORE, timezone: 'auto', forecast_days: '16', wind_speed_unit: 'kmh' });
  return `${OPEN_METEO_URLS.forecast}?${q}`;
}

export function airQualityUrl(place: Pick<Place, 'latitude' | 'longitude'>): string {
  const q = new URLSearchParams({ ...coords(place), current: AIR_CURRENT, hourly: 'us_aqi', timezone: 'auto', forecast_days: '5' });
  return `${OPEN_METEO_URLS.airQuality}?${q}`;
}

export function geocodingUrl(query: string): string {
  const q = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' });
  return `${OPEN_METEO_URLS.geocoding}?${q}`;
}

function pressureTrend(series: Series, from: number): PressureTrend {
  const a = series[from];
  const b = series[Math.min(from + 3, series.length - 1)];
  if (a == null || b == null) return 'steady';
  if (b - a > 1) return 'rising';
  if (a - b > 1) return 'falling';
  return 'steady';
}

const at = <T,>(s: Series<T> | undefined, i: number): T | null => (s ? (s[i] ?? null) : null);

export function mapDaily(d: OpenMeteoForecast['daily']): DailyWeather[] {
  return d.time.map((date, i) => {
    const w = fromWmoCode(d.weather_code[i], true);
    return {
      date,
      condition: w.condition,
      conditionLabel: w.label,
      minC: d.temperature_2m_min[i],
      maxC: d.temperature_2m_max[i],
      precipProbability: at(d.precipitation_probability_max, i),
      precipSumMm: at(d.precipitation_sum, i),
      windMaxKmh: at(d.wind_speed_10m_max, i),
      sunrise: at(d.sunrise, i),
      sunset: at(d.sunset, i),
      uvIndexMax: at(d.uv_index_max, i),
      sunshineSec: at(d.sunshine_duration, i),
      daylightSec: at(d.daylight_duration, i),
      precipHours: at(d.precipitation_hours, i),
      rainSumMm: at(d.rain_sum, i),
      showersSumMm: at(d.showers_sum, i),
      snowfallSumCm: at(d.snowfall_sum, i),
      gustMaxKmh: at(d.wind_gusts_10m_max, i),
      windDirDominantDeg: at(d.wind_direction_10m_dominant, i),
    };
  });
}

function mapAir(air: OpenMeteoAirQuality | null): { pollutants: Pollutants | null; pollen: Pollen | null; euAqi: number | null } {
  const c = air?.current;
  if (!c) return { pollutants: null, pollen: null, euAqi: null };
  const pollutants: Pollutants = { pm25: c.pm2_5 ?? null, pm10: c.pm10 ?? null, o3: c.ozone ?? null, no2: c.nitrogen_dioxide ?? null, so2: c.sulphur_dioxide ?? null, co: c.carbon_monoxide ?? null };
  const pollen: Pollen = { alder: c.alder_pollen ?? null, birch: c.birch_pollen ?? null, grass: c.grass_pollen ?? null, mugwort: c.mugwort_pollen ?? null, olive: c.olive_pollen ?? null, ragweed: c.ragweed_pollen ?? null };
  return {
    pollutants: Object.values(pollutants).some((v) => v != null) ? pollutants : null,
    // Outside Europe every pollen value is null: report "not available", not zero.
    pollen: Object.values(pollen).some((v) => v != null) ? pollen : null,
    euAqi: c.european_aqi ?? null,
  };
}

/** Pure mapping from Open-Meteo responses to the app's Forecast. Unit-tested with real fixtures. */
export function mapOpenMeteo(place: Place, fc: OpenMeteoForecast, air: OpenMeteoAirQuality | null, fetchedAt: string): Forecast {
  const c = fc.current;
  const isDay = c.is_day === 1;
  const now = fromWmoCode(c.weather_code, isDay);
  const h = fc.hourly;

  const aqiByTime = new Map<string, number | null>();
  air?.hourly?.time.forEach((t, i) => aqiByTime.set(t, air.hourly!.us_aqi[i] ?? null));

  const hourly: HourlyWeather[] = h.time.map((time, i) => {
    const day = h.is_day[i] === 1;
    const w = fromWmoCode(h.weather_code[i], day);
    const vis = at(h.visibility, i);
    return {
      time,
      tempC: h.temperature_2m[i],
      feelsLikeC: at(h.apparent_temperature, i) ?? h.temperature_2m[i],
      condition: w.condition,
      conditionLabel: w.label,
      isDay: day,
      precipProbability: at(h.precipitation_probability, i),
      precipMm: at(h.precipitation, i),
      humidity: at(h.relative_humidity_2m, i),
      dewPointC: at(h.dew_point_2m, i),
      windKmh: at(h.wind_speed_10m, i),
      windGustKmh: at(h.wind_gusts_10m, i),
      windDirectionDeg: at(h.wind_direction_10m, i),
      pressureHpa: at(h.pressure_msl, i),
      uvIndex: at(h.uv_index, i),
      visibilityKm: vis == null ? null : vis / 1000,
      aqi: aqiByTime.get(time) ?? null,
      uvClearSky: at(h.uv_index_clear_sky, i),
      cloudCover: at(h.cloud_cover, i),
      cloudLow: at(h.cloud_cover_low, i),
      cloudMid: at(h.cloud_cover_mid, i),
      cloudHigh: at(h.cloud_cover_high, i),
      rainMm: at(h.rain, i),
      showersMm: at(h.showers, i),
      snowfallCm: at(h.snowfall, i),
      wind80Kmh: at(h.wind_speed_80m, i),
      wind120Kmh: at(h.wind_speed_120m, i),
      wind180Kmh: at(h.wind_speed_180m, i),
    };
  });

  const currentHour = c.time.slice(0, 13);
  const nowIndex = Math.max(0, h.time.findIndex((t) => t.slice(0, 13) >= currentHour));
  const minutely15: QuarterHour[] = fc.minutely_15 ? fc.minutely_15.time.map((time, i) => ({ time, precipMm: at(fc.minutely_15!.precipitation, i) })) : [];
  const a = mapAir(air);

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
      pressureTrend: pressureTrend(h.pressure_msl, nowIndex),
      visibilityKm: c.visibility == null ? null : c.visibility / 1000,
      uvIndex: c.uv_index ?? null,
      precipMm: c.precipitation ?? null,
      aqi: air?.current?.us_aqi ?? null,
      euAqi: a.euAqi,
      pollutants: a.pollutants,
      pollen: a.pollen,
    },
    hourly,
    daily: mapDaily(fc.daily),
    minutely15,
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

/** Fetches the full forecast; if Open-Meteo rejects the extended request, falls back to the core fields. */
async function fetchForecast(place: Place, signal?: AbortSignal): Promise<OpenMeteoForecast> {
  try {
    return await fetchJson<OpenMeteoForecast>(forecastUrl(place), signal);
  } catch (err) {
    const e = err as WeatherProviderError;
    if (e?.name === 'WeatherProviderError' && e.kind === 'http' && e.status === 400) {
      return fetchJson<OpenMeteoForecast>(forecastUrl(place, { extras: false }), signal);
    }
    throw err;
  }
}

export function createOpenMeteoProvider(): WeatherProvider {
  return {
    id: 'open-meteo',
    name: 'Open-Meteo',
    async getForecast(place, options) {
      const signal = options?.signal;
      const [fc, air] = await Promise.all([
        fetchForecast(place, signal),
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
    async getOutlook(place, options) {
      const body = await fetchJson<Pick<OpenMeteoForecast, 'daily'>>(outlookUrl(place), options?.signal);
      if (!body?.daily) throw new WeatherProviderError('parse', 'The outlook was missing daily data.');
      return mapDaily(body.daily);
    },
    async searchPlaces(query, options) {
      const q = query.trim();
      if (q.length < 2) return [];
      return mapGeocoding(await fetchJson<OpenMeteoGeocoding>(geocodingUrl(q), options?.signal));
    },
  };
}
