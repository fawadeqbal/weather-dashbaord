/**
 * Plain-language readings of the forecast used by the detail screens:
 * when rain starts and stops, how heavy it is, when to protect from UV,
 * how pollutants compare with health guidelines, and so on.
 * Pure functions, so they are easy to test.
 */
import type { Format } from './format';
import { hoursOn, nowIndex } from './selectors';
import { formatDuration, minutesBetween } from './time';
import type { CurrentWeather, DailyWeather, Forecast, HourlyWeather, Pollen, Pollutants } from './types';

/** Adds minutes to a local wall-clock ISO string ("2026-11-23T14:00"). */
export function addMinutes(local: string, minutes: number): string {
  const [d, t = '00:00'] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const ms = Date.UTC(y, mo - 1, da, h, mi) + minutes * 60_000;
  return new Date(ms).toISOString().slice(0, 16);
}

// ── Rain intensity ──────────────────────────────────────────────────────────

export type Intensity = 'none' | 'light' | 'moderate' | 'heavy';

/** Rain rate in mm per hour → a word (UK Met Office bands). */
export function intensityOf(mmPerHour: number | null | undefined): Intensity {
  const r = mmPerHour ?? 0;
  if (r < 0.1) return 'none';
  if (r < 2.5) return 'light';
  if (r < 7.6) return 'moderate';
  return 'heavy';
}

export const INTENSITY_WORD: Record<Intensity, string> = { none: 'Dry', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' };

export interface NowcastStep {
  time: string;
  /** Rate in mm/h, so 15-minute and hourly steps compare. */
  rateMmH: number;
  intensity: Intensity;
}

/** The next couple of hours of precipitation: 15-minute steps when available, else hourly. */
export function nowcastSteps(f: Forecast, nowLocal: string): { steps: NowcastStep[]; resolution: 15 | 60 } {
  const q = (f.minutely15 ?? []).filter((s) => s.time >= addMinutes(nowLocal, -14));
  if (q.length >= 4) {
    // Two hours of 15-minute steps.
    return {
      resolution: 15,
      steps: q.slice(0, 8).map((s) => {
        const rate = (s.precipMm ?? 0) * 4;
        return { time: s.time, rateMmH: rate, intensity: intensityOf(rate) };
      }),
    };
  }
  const i = nowIndex(f, nowLocal);
  return {
    resolution: 60,
    steps: f.hourly.slice(i, i + 3).map((h) => ({ time: h.time, rateMmH: h.precipMm ?? 0, intensity: intensityOf(h.precipMm) })),
  };
}

/** One sentence about the next two hours: "Light rain stops around 15:45." */
export function nowcastSummary(steps: NowcastStep[], fmt: Format, noun = 'rain'): string {
  if (!steps.length) return 'No short-range data for this place.';
  const wetNow = steps[0].intensity !== 'none';
  const peak = steps.reduce((a, b) => (b.rateMmH > a.rateMmH ? b : a), steps[0]);
  if (wetNow) {
    const stop = steps.findIndex((s) => s.intensity === 'none');
    if (stop < 0) return `${INTENSITY_WORD[peak.intensity]} ${noun} for at least the next ${formatDuration(minutesBetween(steps[0].time, steps[steps.length - 1].time) + 15)}.`;
    return `${INTENSITY_WORD[steps[0].intensity]} ${noun} now, stopping around ${fmt.clock(steps[stop].time)}.`;
  }
  const start = steps.findIndex((s) => s.intensity !== 'none');
  if (start < 0) return `No ${noun} expected in the next ${steps.length >= 8 ? '2 hours' : 'few hours'}.`;
  return `${INTENSITY_WORD[steps[start].intensity]} ${noun} starting around ${fmt.clock(steps[start].time)}.`;
}

export interface NextRain {
  /** Local time of the first wet hour, or null when dry all week. */
  time: string | null;
  /** The wet hour itself. */
  hour?: HourlyWeather;
  /** True when it is wet in the current hour. */
  now: boolean;
}

/** The first hour from now with a real chance of rain or snow (≥ 40% or ≥ 0.2 mm). */
export function nextRain(f: Forecast, nowLocal: string): NextRain {
  const i = nowIndex(f, nowLocal);
  const wet = (h: HourlyWeather) => (h.precipProbability ?? 0) >= 40 || (h.precipMm ?? 0) >= 0.2;
  for (let k = i; k < f.hourly.length; k++) {
    if (wet(f.hourly[k])) return { time: f.hourly[k].time, hour: f.hourly[k], now: k === i };
  }
  return { time: null, now: false };
}

/** Rain, showers and snowfall summed over a set of hours. */
export function precipSplit(hours: HourlyWeather[]): { rainMm: number; showersMm: number; snowCm: number; known: boolean } {
  const known = hours.some((h) => h.rainMm != null || h.showersMm != null || h.snowfallCm != null);
  const sum = (k: 'rainMm' | 'showersMm' | 'snowfallCm') => hours.reduce((a, h) => a + (h[k] ?? 0), 0);
  return { rainMm: sum('rainMm'), showersMm: sum('showersMm'), snowCm: sum('snowfallCm'), known };
}

// ── UV ──────────────────────────────────────────────────────────────────────

/** First and last hour today with UV 3 or more, when protection is advised. */
export function uvWindow(f: Forecast, date: string): { from: string; to: string } | null {
  const hrs = hoursOn(f, date).filter((h) => (h.uvIndex ?? 0) >= 3);
  if (!hrs.length) return null;
  return { from: hrs[0].time, to: addMinutes(hrs[hrs.length - 1].time, 60) };
}

// ── Wind ────────────────────────────────────────────────────────────────────

export const BEAUFORT = [
  { max: 1, label: 'Calm', note: 'Smoke rises straight up.' },
  { max: 12, label: 'Light', note: 'Leaves rustle; you feel it on your face.' },
  { max: 29, label: 'Moderate', note: 'Small branches move; dust and paper lift.' },
  { max: 50, label: 'Fresh to strong', note: 'Large branches sway; umbrellas are hard to use.' },
  { max: 75, label: 'Gale', note: 'Walking into the wind is hard; twigs break.' },
  { max: Infinity, label: 'Storm', note: 'Damage to trees and roofs is likely.' },
];

export function beaufortBand(kmh: number): number {
  return BEAUFORT.findIndex((b) => kmh < b.max);
}

/** The strongest gust in a set of hours. */
export function gustPeak(hours: HourlyWeather[]): HourlyWeather | null {
  return hours.reduce<HourlyWeather | null>((a, h) => ((h.windGustKmh ?? -1) > (a?.windGustKmh ?? -1) ? h : a), null);
}

// ── Air quality ─────────────────────────────────────────────────────────────

export type PollutantKey = keyof Pollutants;

/** WHO 2021 air-quality guideline levels (24-hour, or 8-hour for ozone), µg/m³. */
export const POLLUTANTS: { key: PollutantKey; name: string; short: string; guideline: number; about: string }[] = [
  { key: 'pm25', name: 'Fine particles', short: 'PM2.5', guideline: 15, about: 'Smoke, traffic and industry. Reaches deep into the lungs.' },
  { key: 'pm10', name: 'Coarse particles', short: 'PM10', guideline: 45, about: 'Dust, pollen and road wear.' },
  { key: 'o3', name: 'Ozone', short: 'O₃', guideline: 100, about: 'Forms in sunshine from traffic fumes; highest in the afternoon.' },
  { key: 'no2', name: 'Nitrogen dioxide', short: 'NO₂', guideline: 25, about: 'Mostly from road traffic.' },
  { key: 'so2', name: 'Sulphur dioxide', short: 'SO₂', guideline: 40, about: 'From burning coal and oil.' },
  { key: 'co', name: 'Carbon monoxide', short: 'CO', guideline: 4000, about: 'From engines and stoves.' },
];

export function euAqiLabel(v: number): string {
  if (v <= 20) return 'Good';
  if (v <= 40) return 'Fair';
  if (v <= 60) return 'Moderate';
  if (v <= 80) return 'Poor';
  if (v <= 100) return 'Very poor';
  return 'Extremely poor';
}

export type PollenKey = keyof Pollen;
export const POLLEN_NAMES: Record<PollenKey, string> = { alder: 'Alder', birch: 'Birch', grass: 'Grass', mugwort: 'Mugwort', olive: 'Olive', ragweed: 'Ragweed' };

/** Pollen grains per m³ → a word. */
export function pollenLevel(grains: number | null | undefined): { level: 0 | 1 | 2 | 3 | 4; label: string } {
  const g = grains ?? 0;
  if (g < 1) return { level: 0, label: 'None' };
  if (g < 10) return { level: 1, label: 'Low' };
  if (g < 50) return { level: 2, label: 'Moderate' };
  if (g < 200) return { level: 3, label: 'High' };
  return { level: 4, label: 'Very high' };
}

// ── Humidity and feels like ─────────────────────────────────────────────────

export const DEW_BANDS = [
  { max: 10, label: 'Dry' },
  { max: 16, label: 'Comfortable' },
  { max: 19, label: 'Slightly humid' },
  { max: 22, label: 'Humid' },
  { max: Infinity, label: 'Oppressive' },
];

export function dewBand(dewC: number): number {
  return DEW_BANDS.findIndex((b) => dewC < b.max);
}

/** Why it feels warmer or colder than the thermometer says. */
export function feelsCauses(c: CurrentWeather, fmt: Format): { icon: 'wind' | 'humidity' | 'sun' | 'thermometer'; title: string; text: string }[] {
  const out: ReturnType<typeof feelsCauses> = [];
  const diff = c.feelsLikeC - c.tempC;
  if (c.tempC <= 12 && c.windKmh >= 8 && diff < -0.5) {
    out.push({ icon: 'wind', title: 'Wind chill', text: `A ${fmt.windText(c.windKmh)} wind carries heat away from your skin, taking about ${fmt.tempDelta(-diff)} off.` });
  }
  if (c.tempC >= 24 && c.humidity >= 50 && diff > 0.5) {
    out.push({ icon: 'humidity', title: 'Humidity', text: `At ${Math.round(c.humidity)}% humidity sweat dries slowly, so it feels about ${fmt.tempDelta(diff)} warmer.` });
  }
  if (c.isDay && (c.uvIndex ?? 0) >= 5 && diff >= 0) {
    out.push({ icon: 'sun', title: 'Strong sun', text: 'In direct sun it will feel warmer still; the figure is for the shade.' });
  }
  if (!out.length) out.push({ icon: 'thermometer', title: 'Little effect', text: 'Wind and humidity are not changing how warm it feels much right now.' });
  return out;
}

// ── Sun ─────────────────────────────────────────────────────────────────────

/** Approximate golden hours: the hour after sunrise and the hour before sunset. */
export function goldenHours(day: DailyWeather | undefined): { morning: [string, string]; evening: [string, string] } | null {
  if (!day?.sunrise || !day.sunset) return null;
  return { morning: [day.sunrise, addMinutes(day.sunrise, 60)], evening: [addMinutes(day.sunset, -60), day.sunset] };
}

/** Daylight change versus the day before, in minutes (positive = longer). */
export function daylightChange(f: Forecast, dayIndex: number): { minutes: number; vs: 'yesterday' | 'tomorrow' } | null {
  const len = (d?: DailyWeather) => (d?.sunrise && d.sunset ? minutesBetween(d.sunrise, d.sunset) : null);
  const today = len(f.daily[dayIndex]);
  if (today == null) return null;
  const prev = len(f.daily[dayIndex - 1]);
  if (prev != null) return { minutes: today - prev, vs: 'yesterday' };
  const next = len(f.daily[dayIndex + 1]);
  if (next != null) return { minutes: next - today, vs: 'tomorrow' };
  return null;
}

// ── Clouds ──────────────────────────────────────────────────────────────────

export function cloudWord(pct: number | null | undefined): string {
  const p = pct ?? 0;
  if (p < 12) return 'Clear';
  if (p < 38) return 'Mostly clear';
  if (p < 63) return 'Partly cloudy';
  if (p < 88) return 'Mostly cloudy';
  return 'Overcast';
}

// ── Alerts ──────────────────────────────────────────────────────────────────

/** Practical steps for a warning, chosen from words in its title. */
export function alertAdvice(title: string): string[] {
  const t = title.toLowerCase();
  if (/wind|gale|storm/.test(t)) return ['Secure loose objects outside: bins, furniture, trampolines.', 'Allow extra time; expect delays to trains, ferries and flights.', 'Keep away from coasts and tall trees during the strongest gusts.'];
  if (/flood|rain/.test(t)) return ['Do not walk or drive through flood water; 30 cm can float a car.', 'Move valuables upstairs if your home has flooded before.', 'Check your route before you set out.'];
  if (/snow|ice|freez/.test(t)) return ['Walk carefully; paths and roads may be icy.', 'Allow extra time and carry a warm layer, water and a phone charger.', 'Check on neighbours who may need help.'];
  if (/heat|hot/.test(t)) return ['Drink water through the day and stay out of the midday sun.', 'Keep rooms cool: close curtains on sunny windows.', 'Check on older people and young children.'];
  if (/fog/.test(t)) return ['Drive slowly with dipped headlights.', 'Allow extra time for journeys.'];
  if (/thunder|lightning/.test(t)) return ['Go indoors when you hear thunder.', 'Avoid open fields, hilltops and water.', 'Unplug sensitive electronics.'];
  if (/aurora/.test(t)) return ['Head away from city lights after dark and look north.', 'Give your eyes 15 minutes to adjust; a phone camera shows more colour.'];
  return ['Follow advice from your local weather service.', 'Check the forecast again before you travel.'];
}
