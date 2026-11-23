/**
 * The app's own weather model. Every provider maps its API response into these
 * types, so the UI never depends on a particular weather API.
 *
 * Conventions:
 * - All measurements are metric: °C, km/h, km, hPa. Conversion to the viewer's
 *   units happens at display time (see units.ts).
 * - Times are the place's LOCAL wall-clock time as ISO strings without an offset,
 *   e.g. "2026-11-23T14:41". Dates are "2026-11-23".
 */
import type { Condition } from '../design-system';

export interface Place {
  /** Stable id, e.g. "geo:3413829" or "37.77,-122.42". */
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
  /** US AQI, or null when the provider has no air-quality data. */
  aqi: number | null;
}

export interface HourlyWeather {
  time: string;
  tempC: number;
  condition: Condition;
  conditionLabel: string;
  isDay: boolean;
  /** Chance of precipitation, 0–100, or null if unknown. */
  precipProbability: number | null;
}

export interface DailyWeather {
  date: string;
  condition: Condition;
  conditionLabel: string;
  minC: number;
  maxC: number;
  precipProbability: number | null;
  /** Local times. */
  sunrise: string | null;
  sunset: string | null;
  uvIndexMax: number | null;
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
  /** Hourly values starting at the current hour, at least the next 24 hours. */
  hourly: HourlyWeather[];
  /** Daily values starting today, usually 7 days. */
  daily: DailyWeather[];
  alerts: WeatherAlert[];
  /** Human-readable name of the data source, for attribution. */
  source: { name: string; url?: string };
  /**
   * True for built-in sample data, whose `current.time` is a fixed moment.
   * Live forecasts show the place's real current local time instead.
   */
  isSample?: boolean;
}
