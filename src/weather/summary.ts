import { formatTemp, type Condition } from '../design-system';
import type { Forecast } from './types';
import { speed, toUnitTemp, type Unit } from './units';
import { formatClock, minutesSinceMidnight } from './time';

const WET: ReadonlySet<Condition> = new Set<Condition>(['rain', 'snow', 'storm']);

function precipWord(c: Condition): string {
  if (c === 'snow') return 'Snow';
  if (c === 'storm') return 'Thunderstorms';
  return 'Rain';
}

/**
 * A one- or two-sentence forecast in the Nimbus voice, built from the data:
 * what the sky does next (with a time), then the temperature to expect.
 *   "Dry for the next 24 hours. High of 19° this afternoon."
 *   "Rain easing around 7 AM. Low of 6° overnight. Gusts up to 58 km/h."
 */
export function summarize(f: Forecast, unit: Unit, nowLocal: string = f.current.time): string {
  const next = f.hourly.slice(0, 25);
  const parts: string[] = [];

  if (WET.has(f.current.condition)) {
    const clears = next.findIndex((h, i) => i > 0 && (h.precipProbability ?? 0) < 30 && !WET.has(h.condition));
    parts.push(
      clears > 0
        ? `${precipWord(f.current.condition)} easing around ${formatClock(next[clears].time, true)}.`
        : `${precipWord(f.current.condition)} through the next 24 hours.`,
    );
  } else {
    const wet = next.findIndex((h, i) => i > 0 && (h.precipProbability ?? 0) >= 50);
    parts.push(wet > 0 ? `${precipWord(next[wet].condition)} likely from ${formatClock(next[wet].time, true)}.` : 'Dry for the next 24 hours.');
  }

  const t = (c: number) => formatTemp(toUnitTemp(c, unit));
  const hour = minutesSinceMidnight(nowLocal) / 60;
  const today = f.daily[0];
  if (today && hour < 15) {
    parts.push(`High of ${t(today.maxC)} this afternoon.`);
  } else if (next.length > 1) {
    const overnight = Math.min(...next.slice(0, 13).map((h) => h.tempC));
    parts.push(`Low of ${t(overnight)} overnight.`);
  }

  if (f.current.windGustKmh >= 50) {
    const g = speed(f.current.windGustKmh, unit);
    parts.push(`Gusts up to ${g.value} ${g.unit}.`);
  }
  return parts.join(' ');
}
