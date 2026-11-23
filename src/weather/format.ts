/**
 * Unit preferences and every display format in one place. Values in the model
 * are metric; `makeFormat(prefs)` returns formatters in the viewer's units.
 */
import { formatTemp } from '../design-system';

export type TempUnit = 'C' | 'F';
export type WindUnit = 'kmh' | 'mph' | 'ms' | 'kn';
export type PressureUnit = 'hPa' | 'inHg' | 'mmHg';
export type DistanceUnit = 'km' | 'mi';
export type PrecipUnit = 'mm' | 'in';
export type ClockFormat = '12h' | '24h';

export interface UnitPrefs {
  temp: TempUnit;
  wind: WindUnit;
  pressure: PressureUnit;
  distance: DistanceUnit;
  precip: PrecipUnit;
  clock: ClockFormat;
}

export const METRIC: UnitPrefs = { temp: 'C', wind: 'kmh', pressure: 'hPa', distance: 'km', precip: 'mm', clock: '24h' };
export const IMPERIAL: UnitPrefs = { temp: 'F', wind: 'mph', pressure: 'inHg', distance: 'mi', precip: 'in', clock: '12h' };

/** Switching °C/°F from the quick toggle moves the related units with it, keeping the clock as chosen. */
export function withTemp(prefs: UnitPrefs, temp: TempUnit): UnitPrefs {
  const base = temp === 'F' ? IMPERIAL : METRIC;
  return { ...base, clock: prefs.clock };
}

/** Locale defaults: imperial for US-style locales, metric elsewhere; 12h clock for English locales that use it. */
export function defaultPrefs(lang: string = typeof navigator !== 'undefined' ? navigator.language : 'en-GB'): UnitPrefs {
  const imperial = /^en-(US|LR|MM)$/i.test(lang);
  const twelve = /^en-(US|CA|AU|NZ|IN|PH)$/i.test(lang) || /^(hi|ar|bn|ur)/i.test(lang);
  return { ...(imperial ? IMPERIAL : METRIC), clock: twelve ? '12h' : '24h' };
}

export function isUnitPrefs(v: unknown): v is UnitPrefs {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    (p.temp === 'C' || p.temp === 'F') &&
    ['kmh', 'mph', 'ms', 'kn'].includes(p.wind as string) &&
    ['hPa', 'inHg', 'mmHg'].includes(p.pressure as string) &&
    (p.distance === 'km' || p.distance === 'mi') &&
    (p.precip === 'mm' || p.precip === 'in') &&
    (p.clock === '12h' || p.clock === '24h')
  );
}

export const WIND_LABEL: Record<WindUnit, string> = { kmh: 'km/h', mph: 'mph', ms: 'm/s', kn: 'kn' };

export interface Measure {
  value: number;
  /** Value as display text, e.g. "30.06". */
  text: string;
  unit: string;
}

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function parts(localIso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(localIso);
  if (!m) throw new Error(`Not a local ISO time: ${localIso}`);
  return { h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0 };
}

export function makeFormat(prefs: UnitPrefs) {
  const tempValue = (c: number) => (prefs.temp === 'F' ? (c * 9) / 5 + 32 : c);

  const wind = (kmh: number): Measure => {
    const v = prefs.wind === 'mph' ? kmh * 0.621371 : prefs.wind === 'ms' ? kmh / 3.6 : prefs.wind === 'kn' ? kmh * 0.539957 : kmh;
    const value = round(v);
    return { value, text: String(value), unit: WIND_LABEL[prefs.wind] };
  };

  const pressure = (hpa: number): Measure => {
    if (prefs.pressure === 'inHg') {
      const value = round(hpa * 0.02953, 2);
      return { value, text: value.toFixed(2), unit: 'inHg' };
    }
    if (prefs.pressure === 'mmHg') {
      const value = round(hpa * 0.750062);
      return { value, text: String(value), unit: 'mmHg' };
    }
    const value = round(hpa);
    return { value, text: String(value), unit: 'hPa' };
  };

  const distance = (km: number): Measure => {
    const v = prefs.distance === 'mi' ? km * 0.621371 : km;
    const value = v >= 10 ? round(v) : round(v, 1);
    return { value, text: String(value), unit: prefs.distance };
  };

  const precip = (mm: number): Measure => {
    if (prefs.precip === 'in') {
      const value = round(mm / 25.4, 2);
      return { value, text: value.toFixed(2), unit: 'in' };
    }
    const value = round(mm, 1);
    return { value, text: String(value), unit: 'mm' };
  };

  /** "2:41 PM" / "14:41"; with `short`, "2 PM" / "14:00" on the hour. */
  const clock = (localIso: string, short = false) => {
    const { h, mi } = parts(localIso);
    if (prefs.clock === '24h') return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    const suffix = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    if (short && mi === 0) return `${h12} ${suffix}`;
    return `${h12}:${String(mi).padStart(2, '0')} ${suffix}`;
  };

  return {
    prefs,
    tempValue,
    temp: (c: number) => formatTemp(tempValue(c)),
    tempUnitLabel: prefs.temp === 'F' ? '°F' : '°C',
    /** A temperature difference, e.g. "3°C" or "5°F" (no 32° offset). */
    tempDelta: (dc: number) => `${Math.max(1, Math.round(prefs.temp === 'F' ? (Math.abs(dc) * 9) / 5 : Math.abs(dc)))}°${prefs.temp}`,
    wind,
    windText: (kmh: number) => {
      const m = wind(kmh);
      return `${m.text} ${m.unit}`;
    },
    pressure,
    distance,
    precip,
    clock,
  };
}

export type Format = ReturnType<typeof makeFormat>;
