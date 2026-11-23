/**
 * Turns a provider-neutral Forecast into exactly what the Nimbus components
 * display, in the viewer's units. Keeping this pure makes the screen easy to
 * test and keeps formatting rules in one place.
 */
import type { CurrentConditionsProps, DayForecast, HourPoint, Scene } from '../design-system';
import { chooseScene, type Precip } from './conditions';
import { PHOTOS, type SkyPhoto } from './scenes';
import { summarize } from './summary';
import { formatClock, formatDuration, formatLongDate, localNowIn, minutesBetween, minutesSinceMidnight, weekdayShort } from './time';
import type { Forecast, WeatherAlert } from './types';
import { aqiAdvice, aqiLabel, compassPoint, compassWords, distance, pressure, speed, toUnitTemp, uvAdvice, uvLabel, type Unit } from './units';

export interface ForecastView {
  scene: Scene;
  photo: SkyPhoto;
  scrim: 'normal' | 'strong';
  precip: Precip;
  localDate: string;
  localTime: string;
  hero: CurrentConditionsProps;
  hours: HourPoint[];
  days: DayForecast[];
  alert: WeatherAlert | null;
  wind: { value: number; unit: string; from: string; fromWords: string; degrees: number; gusts: string };
  uv: { value: number; label: string; advice: string } | null;
  humidity: { value: number; dewPoint: number };
  sun: { progress: number; sunrise: string; sunset: string; note: string } | null;
  aqi: { value: number; label: string; advice: string } | null;
  pressure: { value: string; unit: string; trend: string; hpa: number };
  visibility: { value: number; unit: string } | null;
  card: { temp: number; high: number; low: number; localTime: string };
}

const HOUR_STEP = 3;

/** The place's local time now: the real clock for live data, the fixed moment for sample data. */
export function localNow(f: Forecast, now: Date = new Date()): string {
  if (f.isSample) return f.current.time;
  const t = localNowIn(f.timezone, now, f.current.time);
  // Never show a time before the observation (clock skew).
  return t < f.current.time ? f.current.time : t;
}

export function presentForecast(f: Forecast, unit: Unit, now: Date = new Date()): ForecastView {
  const t = (c: number) => toUnitTemp(c, unit);
  const today = f.daily[0];
  const nowLocal = localNow(f, now);
  const choice = chooseScene({ ...f.current, time: nowLocal }, today, f.place.latitude);
  const { scene, precip } = choice;
  const photo = PHOTOS[choice.photo];

  const w = speed(f.current.windKmh, unit);
  const g = speed(f.current.windGustKmh, unit);
  const vis = f.current.visibilityKm == null ? null : distance(f.current.visibilityKm, unit);
  const p = pressure(f.current.pressureHpa, unit);

  const hours: HourPoint[] = [];
  for (let i = 0; i < f.hourly.length && hours.length < 9; i += HOUR_STEP) {
    const h = f.hourly[i];
    hours.push({
      label: i === 0 ? 'Now' : formatClock(h.time, true),
      temp: t(h.tempC),
      condition: h.condition,
      conditionLabel: h.conditionLabel,
      pop: h.precipProbability,
    });
  }

  const days: DayForecast[] = f.daily.map((d, i) => ({
    day: i === 0 ? 'Today' : weekdayShort(d.date),
    condition: d.condition,
    conditionLabel: d.conditionLabel,
    pop: d.precipProbability,
    low: t(d.minC),
    high: t(d.maxC),
  }));

  return {
    scene,
    photo,
    scrim: photo.bright ? 'strong' : 'normal',
    precip,
    localDate: formatLongDate(nowLocal),
    localTime: formatClock(nowLocal),
    hero: {
      temp: t(f.current.tempC),
      condition: f.current.condition,
      conditionLabel: f.current.conditionLabel,
      high: today ? t(today.maxC) : undefined,
      low: today ? t(today.minC) : undefined,
      feelsLike: t(f.current.feelsLikeC),
      summary: summarize(f, unit, nowLocal),
      stats: [
        { label: 'Rain today', value: today?.precipProbability != null ? `${today.precipProbability}%` : '—' },
        { label: 'Wind', value: `${w.value} ${w.unit}` },
        { label: 'Visibility', value: vis ? `${vis.value} ${vis.unit}` : '—' },
      ],
    },
    hours,
    days,
    alert: f.alerts[0] ?? null,
    wind: {
      value: w.value,
      unit: w.unit,
      from: compassPoint(f.current.windDirectionDeg),
      fromWords: compassWords(f.current.windDirectionDeg),
      degrees: f.current.windDirectionDeg,
      gusts: `Gusts up to ${g.value} ${g.unit}`,
    },
    uv: f.current.uvIndex == null ? null : { value: Math.round(f.current.uvIndex), label: uvLabel(f.current.uvIndex), advice: uvAdvice(f.current.uvIndex) },
    humidity: { value: Math.round(f.current.humidity), dewPoint: t(f.current.dewPointC) },
    sun: sunView(f, nowLocal),
    aqi: f.current.aqi == null ? null : { value: Math.round(f.current.aqi), label: aqiLabel(f.current.aqi), advice: aqiAdvice(f.current.aqi) },
    pressure: { ...p, hpa: f.current.pressureHpa, trend: f.current.pressureTrend[0].toUpperCase() + f.current.pressureTrend.slice(1) },
    visibility: vis,
    card: { temp: t(f.current.tempC), high: today ? t(today.maxC) : t(f.current.tempC), low: today ? t(today.minC) : t(f.current.tempC), localTime: formatClock(nowLocal) },
  };
}

function sunView(f: Forecast, now: string): ForecastView['sun'] {
  const today = f.daily[0];
  if (!today?.sunrise || !today.sunset) return null;
  const rise = minutesSinceMidnight(today.sunrise);
  const set = minutesSinceMidnight(today.sunset);
  const cur = minutesSinceMidnight(now);
  let progress: number;
  let note: string;
  if (cur < rise) {
    progress = 0;
    const until = minutesBetween(now, today.sunrise);
    note = until < 1 ? 'The sun is rising now' : `Sunrise in ${formatDuration(until)}`;
  } else if (cur <= set) {
    progress = (cur - rise) / Math.max(set - rise, 1);
    const left = minutesBetween(now, today.sunset);
    note = left < 1 ? 'The sun is setting now' : `Sunset in ${formatDuration(left)}`;
  } else {
    progress = 1;
    const tomorrow = f.daily[1]?.sunrise;
    note = tomorrow ? `Sunrise in ${formatDuration(minutesBetween(now, tomorrow))}` : 'The sun has set';
  }
  return { progress, sunrise: formatClock(today.sunrise), sunset: formatClock(today.sunset), note };
}
