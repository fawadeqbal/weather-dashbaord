/**
 * The app's own weather model. Every provider maps its API response into these
 * types, so the UI never depends on a particular weather API.
 *
 * Conventions:
 * - All measurements are metric: °C, km/h, km, hPa, mm. Conversion to the
 *   viewer's units happens at display time (see format.ts).
 * - Times are the place's LOCAL wall-clock time as ISO strings without an offset,
 *   e.g. "2026-11-23T14:41". Dates are "2026-11-23".
 */
import type { Condition } from '../design-system';

export interface Place {
  /** Stable id, e.g. "geo:3413829", or "here" for the device location. */
  id: string;
  name: string;
  /** Country name, e.g. "Iceland". */
  country: string;
  /** Region shown to tell places with the same name apart, e.g. "California". */
  region?: string;
  latitude: number;
  longitude: number;
  /** IANA time zone, if known. */
  timezone?: string;
}

export type PressureTrend = 'rising' | 'steady' | 'falling';

export interface CurrentWeather {
  /** Local time of the observation. */
  time: string;
  tempC: number;
  feelsLikeC: number;
  condition: Condition;
  conditionLabel: string;
  isDay: boolean;
  /** Raw provider weather code, kept for debugging and future mapping. */
  code?: number | string;
  humidity: number;
  dewPointC: number;
  windKmh: number;
  windGustKmh: number;
  /** Meteorological direction the wind comes FROM, degrees. */
  windDirectionDeg: number;
  pressureHpa: number;
  pressureTrend: PressureTrend;
  visibilityKm: number | null;
  uvIndex: number | null;
  /** Precipitation in the last hour, mm. */
  precipMm: number | null;
  /** US AQI, or null when the provider has no air-quality data. */
  aqi: number | null;
  /** European AQI, or null. */
  euAqi?: number | null;
  /** Pollutant concentrations in µg/m³, or null when not available. */
  pollutants?: Pollutants | null;
  /** Pollen in grains/m³; null outside the provider's coverage (Open-Meteo: Europe). */
  pollen?: Pollen | null;
}

export interface Pollutants {
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
}

export interface Pollen {
  alder: number | null;
  birch: number | null;
  grass: number | null;
  mugwort: number | null;
  olive: number | null;
  ragweed: number | null;
}

/** Precipitation for one 15-minute step (short-range nowcast). */
export interface QuarterHour {
  time: string;
  precipMm: number | null;
}

export interface HourlyWeather {
  time: string;
  tempC: number;
  feelsLikeC: number;
  condition: Condition;
  conditionLabel: string;
  isDay: boolean;
  /** Chance of precipitation, 0–100, or null if unknown. */
  precipProbability: number | null;
  precipMm: number | null;
  humidity: number | null;
  dewPointC: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  windDirectionDeg: number | null;
  pressureHpa: number | null;
  uvIndex: number | null;
  visibilityKm: number | null;
  aqi: number | null;
  /** Optional extras. Providers that lack them leave them undefined or null. */
  uvClearSky?: number | null;
  /** Total and per-layer cloud cover, percent. Low < 2 km, mid 2–6 km, high > 6 km. */
  cloudCover?: number | null;
  cloudLow?: number | null;
  cloudMid?: number | null;
  cloudHigh?: number | null;
  rainMm?: number | null;
  showersMm?: number | null;
  snowfallCm?: number | null;
  /** Wind higher up, km/h. */
  wind80Kmh?: number | null;
  wind120Kmh?: number | null;
  wind180Kmh?: number | null;
}

export interface DailyWeather {
  date: string;
  condition: Condition;
  conditionLabel: string;
  minC: number;
  maxC: number;
  precipProbability: number | null;
  precipSumMm: number | null;
  windMaxKmh: number | null;
  /** Local times. Null in polar day or night. */
  sunrise: string | null;
  sunset: string | null;
  uvIndexMax: number | null;
  /** Optional extras. */
  sunshineSec?: number | null;
  daylightSec?: number | null;
  precipHours?: number | null;
  rainSumMm?: number | null;
  showersSumMm?: number | null;
  snowfallSumCm?: number | null;
  gustMaxKmh?: number | null;
  windDirDominantDeg?: number | null;
}

export type AlertSeverity = 'minor' | 'moderate' | 'severe';

export interface WeatherAlert {
  title: string;
  description: string;
  severity: AlertSeverity;
  /** Local end time, if the provider gives one. */
  ends?: string;
}

export interface Forecast {
  place: Place;
  timezone: string;
  /** ISO timestamp (UTC) of when this forecast was fetched. */
  fetchedAt: string;
  current: CurrentWeather;
  /**
   * Hourly values for every day in `daily`, starting at 00:00 today local time.
   * Use selectors.nextHours() for "from now" views.
   */
  hourly: HourlyWeather[];
  /** Daily values, usually yesterday (when the provider gives it) plus 7 days. Use selectors.dayIndexOf() for today. */
  daily: DailyWeather[];
  /** 15-minute precipitation for about the next 2–3 hours. Empty when the provider has none. */
  minutely15?: QuarterHour[];
  alerts: WeatherAlert[];
  /** Human-readable name of the data source, for attribution. */
  source: { name: string; url?: string };
  /**
   * True for built-in sample data, whose `current.time` is a fixed moment.
   * Live forecasts show the place's real current local time instead.
   */
  isSample?: boolean;
}
