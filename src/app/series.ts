import type { TrendPoint } from '../design-system';
import type { Format } from '../weather/format';
import type { HourlyWeather } from '../weather/types';
import { aqiLabel, compassPoint, uvLabel } from '../weather/units';

export type SeriesKey = 'temp' | 'feels' | 'precip' | 'wind' | 'humidity' | 'uv' | 'pressure' | 'aqi' | 'visibility';

interface SeriesDef {
  label: string;
  kind: 'line' | 'bar';
  min?: number;
  max?: number;
  point: (h: HourlyWeather, fmt: Format) => Omit<TrendPoint, 'label' | 'icon'>;
}

export const SERIES: Record<SeriesKey, SeriesDef> = {
  temp: {
    label: 'Temperature',
    kind: 'line',
    point: (h, fmt) => ({ value: fmt.tempValue(h.tempC), display: fmt.temp(h.tempC), detail: h.conditionLabel }),
  },
  feels: {
    label: 'Feels like',
    kind: 'line',
    point: (h, fmt) => ({ value: fmt.tempValue(h.feelsLikeC), display: fmt.temp(h.feelsLikeC), detail: `Actual ${fmt.temp(h.tempC)}` }),
  },
  precip: {
    label: 'Precipitation',
    kind: 'bar',
    min: 0,
    max: 100,
    point: (h, fmt) => {
      const mm = h.precipMm != null ? fmt.precip(h.precipMm) : null;
      return { value: h.precipProbability, display: h.precipProbability != null ? `${h.precipProbability}%` : '—', detail: mm ? `${mm.text} ${mm.unit}` : undefined };
    },
  },
  wind: {
    label: 'Wind',
    kind: 'line',
    min: 0,
    point: (h, fmt) => {
      if (h.windKmh == null) return { value: null, display: '—' };
      const w = fmt.wind(h.windKmh);
      const g = h.windGustKmh != null ? fmt.wind(h.windGustKmh) : null;
      const dir = h.windDirectionDeg != null ? `from ${compassPoint(h.windDirectionDeg)}` : '';
      return { value: w.value, display: `${w.text} ${w.unit}`, detail: [dir, g ? `gusts ${g.text}` : ''].filter(Boolean).join(', ') };
    },
  },
  humidity: {
    label: 'Humidity',
    kind: 'line',
    min: 0,
    max: 100,
    point: (h, fmt) => ({ value: h.humidity, display: h.humidity != null ? `${Math.round(h.humidity)}%` : '—', detail: h.dewPointC != null ? `Dew point ${fmt.temp(h.dewPointC)}` : undefined }),
  },
  uv: {
    label: 'UV index',
    kind: 'bar',
    min: 0,
    max: 11,
    point: (h) => ({ value: h.uvIndex, display: h.uvIndex != null ? String(Math.round(h.uvIndex)) : '—', detail: h.uvIndex != null ? uvLabel(h.uvIndex) : undefined }),
  },
  pressure: {
    label: 'Pressure',
    kind: 'line',
    point: (h, fmt) => {
      if (h.pressureHpa == null) return { value: null, display: '—' };
      const p = fmt.pressure(h.pressureHpa);
      return { value: p.value, display: `${p.text} ${p.unit}` };
    },
  },
  aqi: {
    label: 'Air quality',
    kind: 'bar',
    min: 0,
    point: (h) => ({ value: h.aqi, display: h.aqi != null ? String(Math.round(h.aqi)) : '—', detail: h.aqi != null ? aqiLabel(h.aqi) : undefined }),
  },
  visibility: {
    label: 'Visibility',
    kind: 'line',
    min: 0,
    point: (h, fmt) => {
      if (h.visibilityKm == null) return { value: null, display: '—' };
      const d = fmt.distance(h.visibilityKm);
      return { value: d.value, display: `${d.text} ${d.unit}` };
    },
  },
};

/** Trend points for a series; the first label is "Now" when `nowFirst`. */
export function pointsFor(key: SeriesKey, hours: HourlyWeather[], fmt: Format, nowFirst = true): TrendPoint[] {
  return hours.map((h, i) => ({
    ...SERIES[key].point(h, fmt),
    label: i === 0 && nowFirst ? 'Now' : fmt.clock(h.time, true),
    icon: h.condition,
  }));
}
