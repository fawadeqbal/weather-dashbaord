import type { Condition } from '../design-system';
import type { Format } from './format';
import { dayIndexOf, nextHours } from './selectors';
import { minutesSinceMidnight } from './time';
import type { Forecast, HourlyWeather } from './types';

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
export function summarize(f: Forecast, fmt: Format, nowLocal: string = f.current.time): string {
  const next: HourlyWeather[] = nextHours(f, nowLocal, 25);
  const parts: string[] = [];

  if (WET.has(f.current.condition)) {
    const clears = next.findIndex((h, i) => i > 0 && (h.precipProbability ?? 0) < 30 && !WET.has(h.condition));
    parts.push(
      clears > 0
        ? `${precipWord(f.current.condition)} easing around ${fmt.clock(next[clears].time, true)}.`
        : `${precipWord(f.current.condition)} through the next 24 hours.`,
    );
  } else {
    const wet = next.findIndex((h, i) => i > 0 && (h.precipProbability ?? 0) >= 50);
    parts.push(wet > 0 ? `${precipWord(next[wet].condition)} likely from ${fmt.clock(next[wet].time, true)}.` : 'Dry for the next 24 hours.');
  }

  const hour = minutesSinceMidnight(nowLocal) / 60;
  const today = f.daily[dayIndexOf(f, nowLocal)];
  if (today && hour < 15) {
    parts.push(`High of ${fmt.temp(today.maxC)} this afternoon.`);
  } else if (next.length > 1) {
    const overnight = Math.min(...next.slice(0, 13).map((h) => h.tempC));
    parts.push(`Low of ${fmt.temp(overnight)} overnight.`);
  }

  if (f.current.windGustKmh >= 50) parts.push(`Gusts up to ${fmt.windText(f.current.windGustKmh)}.`);
  return parts.join(' ');
}

/** One sentence about a whole day, for the day detail page. */
export function summarizeDay(hours: HourlyWeather[], fmt: Format): string {
  if (!hours.length) return '';
  const wet = hours.filter((h) => (h.precipProbability ?? 0) >= 50);
  const warmest = hours.reduce((a, b) => (b.tempC > a.tempC ? b : a));
  const parts: string[] = [];
  if (wet.length) {
    const kind = precipWord(wet[0].condition === 'snow' || wet[0].condition === 'storm' ? wet[0].condition : 'rain');
    parts.push(`${kind} likely from ${fmt.clock(wet[0].time, true)}${wet.length > 1 ? ` to ${fmt.clock(wet[wet.length - 1].time, true)}` : ''}.`);
  } else {
    parts.push('A dry day.');
  }
  parts.push(`Warmest around ${fmt.clock(warmest.time, true)} at ${fmt.temp(warmest.tempC)}.`);
  const gust = Math.max(...hours.map((h) => h.windGustKmh ?? 0));
  if (gust >= 50) parts.push(`Gusts up to ${fmt.windText(gust)}.`);
  return parts.join(' ');
}
