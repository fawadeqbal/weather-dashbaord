import type { Condition, Scene } from '../design-system';
import type { PhotoKey } from './scenes';
import type { CurrentWeather, DailyWeather } from './types';

interface WmoEntry {
  day: Condition;
  night: Condition;
  label: string;
}

/**
 * WMO weather interpretation codes (used by Open-Meteo and many national services)
 * mapped to Nimbus icons and labels. https://open-meteo.com/en/docs#weathervariables
 */
const WMO: Record<number, WmoEntry> = {
  0: { day: 'sun', night: 'moon', label: 'Clear' },
  1: { day: 'sun', night: 'moon', label: 'Mainly clear' },
  2: { day: 'partly', night: 'cloud', label: 'Partly cloudy' },
  3: { day: 'cloud', night: 'cloud', label: 'Overcast' },
  45: { day: 'cloud', night: 'cloud', label: 'Fog' },
  48: { day: 'cloud', night: 'cloud', label: 'Freezing fog' },
  51: { day: 'rain', night: 'rain', label: 'Light drizzle' },
  53: { day: 'rain', night: 'rain', label: 'Drizzle' },
  55: { day: 'rain', night: 'rain', label: 'Heavy drizzle' },
  56: { day: 'rain', night: 'rain', label: 'Freezing drizzle' },
  57: { day: 'rain', night: 'rain', label: 'Freezing drizzle' },
  61: { day: 'rain', night: 'rain', label: 'Light rain' },
  63: { day: 'rain', night: 'rain', label: 'Rain' },
  65: { day: 'rain', night: 'rain', label: 'Heavy rain' },
  66: { day: 'rain', night: 'rain', label: 'Freezing rain' },
  67: { day: 'rain', night: 'rain', label: 'Heavy freezing rain' },
  71: { day: 'snow', night: 'snow', label: 'Light snow' },
  73: { day: 'snow', night: 'snow', label: 'Snow' },
  75: { day: 'snow', night: 'snow', label: 'Heavy snow' },
  77: { day: 'snow', night: 'snow', label: 'Snow grains' },
  80: { day: 'rain', night: 'rain', label: 'Light showers' },
  81: { day: 'rain', night: 'rain', label: 'Showers' },
  82: { day: 'rain', night: 'rain', label: 'Heavy showers' },
  85: { day: 'snow', night: 'snow', label: 'Snow showers' },
  86: { day: 'snow', night: 'snow', label: 'Heavy snow showers' },
  95: { day: 'storm', night: 'storm', label: 'Thunderstorm' },
  96: { day: 'storm', night: 'storm', label: 'Thunderstorm with hail' },
  99: { day: 'storm', night: 'storm', label: 'Thunderstorm with heavy hail' },
};

export function fromWmoCode(code: number, isDay = true): { condition: Condition; label: string } {
  const entry = WMO[code];
  if (!entry) return { condition: 'cloud', label: 'Unknown' };
  return { condition: isDay ? entry.day : entry.night, label: entry.label };
}

export type Precip = 'rain' | 'snow' | null;

export interface SceneChoice {
  /** Theme: retints glass, sky fallback and accent. */
  scene: Scene;
  /** Which sky photo to show. */
  photo: PhotoKey;
  precip: Precip;
}

/** Minutes since midnight for a local "YYYY-MM-DDTHH:mm" string. */
function minutesOf(localIso: string | null | undefined): number | null {
  if (!localIso) return null;
  const m = /T(\d{2}):(\d{2})/.exec(localIso);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Aurora is plausible on clear nights this far from the equator. */
const AURORA_LATITUDE = 58;

/**
 * Picks the theme and sky photo for the current weather:
 * - storms → storm clouds; rain and drizzle → rain on glass; both with falling rain
 * - snow → frost by day, aurora over snow by night; both with falling snow
 * - clear night → stars (aurora at high latitudes); cloudy night → night clouds
 * - fog → fog; overcast → grey clouds; partly cloudy → white clouds
 * - up to 90 minutes after sunrise → sunrise; up to 90 minutes before sunset → dusk
 * - clear day → blue sky, with the Bright sun theme at UV 6+ or 24°C+
 */
export function chooseScene(
  current: Pick<CurrentWeather, 'condition' | 'conditionLabel' | 'isDay' | 'time' | 'tempC' | 'uvIndex'>,
  today?: Pick<DailyWeather, 'sunrise' | 'sunset'>,
  latitude = 0,
): SceneChoice {
  const c = current.condition;
  if (c === 'storm') return { scene: 'rain', photo: 'storm', precip: 'rain' };
  if (c === 'rain') return { scene: 'rain', photo: 'rain', precip: 'rain' };
  if (c === 'snow') return { scene: 'aurora', photo: current.isDay ? 'snow' : 'aurora', precip: 'snow' };
  if (!current.isDay) {
    if (c === 'moon') return { scene: 'aurora', photo: Math.abs(latitude) >= AURORA_LATITUDE ? 'aurora' : 'night', precip: null };
    return { scene: 'rain', photo: 'night-cloudy', precip: null };
  }
  if (/fog/i.test(current.conditionLabel)) return { scene: 'clear', photo: 'fog', precip: null };
  if (c === 'cloud') return { scene: 'clear', photo: 'overcast', precip: null };

  const now = minutesOf(current.time);
  const rise = minutesOf(today?.sunrise);
  const set = minutesOf(today?.sunset);
  if (now !== null && rise !== null && now >= rise && now - rise <= 90) return { scene: 'dawn', photo: 'dawn', precip: null };
  if (now !== null && set !== null && now <= set && set - now <= 90) return { scene: 'dawn', photo: 'dusk', precip: null };
  if (c === 'partly') return { scene: 'clear', photo: 'partly', precip: null };
  if ((current.uvIndex ?? 0) >= 6 || current.tempC >= 24) return { scene: 'sun', photo: 'sunny', precip: null };
  return { scene: 'clear', photo: 'sunny', precip: null };
}
