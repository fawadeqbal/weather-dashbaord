/**
 * Pure helpers that pick what a screen shows out of a Forecast. They take the
 * place's local "now" so live data follows the real clock and sample data
 * stays at its fixed moment.
 */
import { chooseScene, type SceneChoice } from './conditions';
import type { Format } from './format';
import { PHOTOS, type SkyPhoto } from './scenes';
import { formatDuration, localNowIn, minutesBetween, minutesSinceMidnight, weekdayLong, weekdayShort } from './time';
import type { DailyWeather, Forecast, HourlyWeather } from './types';

/** The place's local time now: the real clock for live data, the fixed moment for sample data. */
export function localNow(f: Forecast, now: Date = new Date()): string {
  if (f.isSample) return f.current.time;
  const t = localNowIn(f.timezone, now, f.current.time);
  // Never show a time before the observation (clock skew).
  return t < f.current.time ? f.current.time : t;
}

/** Index of the hour containing `nowLocal` (or the first later hour). */
export function nowIndex(f: Forecast, nowLocal: string): number {
  const hour = nowLocal.slice(0, 13);
  const i = f.hourly.findIndex((h) => h.time.slice(0, 13) >= hour);
  return i < 0 ? Math.max(0, f.hourly.length - 1) : i;
}

/** `count` hours starting with the current one. */
export function nextHours(f: Forecast, nowLocal: string, count = 24): HourlyWeather[] {
  const i = nowIndex(f, nowLocal);
  return f.hourly.slice(i, i + count);
}

export function hoursOn(f: Forecast, date: string): HourlyWeather[] {
  return f.hourly.filter((h) => h.time.startsWith(date));
}

export function dayIndexOf(f: Forecast, nowLocal: string): number {
  const i = f.daily.findIndex((d) => d.date === nowLocal.slice(0, 10));
  return i < 0 ? 0 : i;
}

/** "Today", "Tomorrow", then weekday names. `long` gives "Wednesday". */
export function dayLabel(f: Forecast, index: number, nowLocal: string, long = false): string {
  const todayIdx = dayIndexOf(f, nowLocal);
  if (index === todayIdx) return 'Today';
  if (index === todayIdx + 1) return 'Tomorrow';
  const date = f.daily[index]?.date;
  if (!date) return '';
  return long ? weekdayLong(date) : weekdayShort(date);
}

export interface SceneView extends SceneChoice {
  photoLayer: SkyPhoto;
  scrim: 'normal' | 'strong';
}

export function sceneFor(f: Forecast, nowLocal: string): SceneView {
  const today = f.daily[dayIndexOf(f, nowLocal)];
  const choice = chooseScene({ ...f.current, time: nowLocal }, today, f.place.latitude);
  const photoLayer = PHOTOS[choice.photo];
  return { ...choice, photoLayer, scrim: photoLayer.bright ? 'strong' : 'normal' };
}

export interface SunInfo {
  /** 0 at sunrise, 1 at sunset, for the arc. */
  progress: number;
  sunrise: string | null;
  sunset: string | null;
  daylightMinutes: number | null;
  note: string;
}

export function sunInfo(f: Forecast, nowLocal: string, fmt: Format, dayIndex = dayIndexOf(f, nowLocal)): SunInfo {
  const day: DailyWeather | undefined = f.daily[dayIndex];
  if (!day?.sunrise || !day.sunset) {
    return { progress: 0, sunrise: null, sunset: null, daylightMinutes: null, note: 'No sunrise or sunset at this latitude today.' };
  }
  const daylight = minutesBetween(day.sunrise, day.sunset);
  const isToday = day.date === nowLocal.slice(0, 10);
  if (!isToday) {
    return { progress: 0.5, sunrise: fmt.clock(day.sunrise), sunset: fmt.clock(day.sunset), daylightMinutes: daylight, note: `${formatDuration(daylight)} of daylight` };
  }
  const rise = minutesSinceMidnight(day.sunrise);
  const set = minutesSinceMidnight(day.sunset);
  const cur = minutesSinceMidnight(nowLocal);
  let progress: number;
  let note: string;
  if (cur < rise) {
    progress = 0;
    const until = minutesBetween(nowLocal, day.sunrise);
    note = until < 1 ? 'The sun is rising now' : `Sunrise in ${formatDuration(until)}`;
  } else if (cur <= set) {
    progress = (cur - rise) / Math.max(set - rise, 1);
    const left = minutesBetween(nowLocal, day.sunset);
    note = left < 1 ? 'The sun is setting now' : `Sunset in ${formatDuration(left)}`;
  } else {
    progress = 1;
    const tomorrow = f.daily[dayIndex + 1]?.sunrise;
    note = tomorrow ? `Sunrise in ${formatDuration(minutesBetween(nowLocal, tomorrow))}` : 'The sun has set';
  }
  return { progress, sunrise: fmt.clock(day.sunrise), sunset: fmt.clock(day.sunset), daylightMinutes: daylight, note };
}

/** Today's high and low (falls back to the current temperature). */
export function todayRange(f: Forecast, nowLocal: string): { minC: number; maxC: number } {
  const d = f.daily[dayIndexOf(f, nowLocal)];
  return d ? { minC: d.minC, maxC: d.maxC } : { minC: f.current.tempC, maxC: f.current.tempC };
}
