/**
 * A tiny hash router. Hash URLs work on GitHub Pages without server rewrites,
 * and every screen has its own address, so Back, refresh and sharing work.
 *
 *   #/                          Today for the selected city
 *   #/p/5391959                 Today for a city (GeoNames id; "here" = device location)
 *   #/p/5391959/hourly          Hourly detail
 *   #/p/5391959/day/2           Day detail (0 = first forecast day)
 *   #/p/5391959/metric/wind     Metric detail
 *   #/locations                 Saved locations
 *   #/settings                  Settings
 */
import { useEffect, useState } from 'react';

export const METRICS = ['feels', 'wind', 'precip', 'uv', 'humidity', 'air', 'sun', 'pressure', 'visibility'] as const;
export type MetricKey = (typeof METRICS)[number];
export const isMetric = (s: string): s is MetricKey => (METRICS as readonly string[]).includes(s);

export type Route =
  | { name: 'today'; placeId?: string }
  | { name: 'hourly'; placeId: string }
  | { name: 'day'; placeId: string; index: number }
  | { name: 'metric'; placeId: string; metric: MetricKey }
  | { name: 'locations' }
  | { name: 'settings' }
  | { name: 'notfound' };

/** Place id → URL segment: "geo:5391959" → "5391959". */
export const placeSegment = (id: string) => encodeURIComponent(id.replace(/^geo:/, ''));
/** URL segment → place id. */
export const placeIdFrom = (seg: string) => {
  const s = decodeURIComponent(seg);
  return /^\d+$/.test(s) ? `geo:${s}` : s;
};

export const href = {
  today: (placeId?: string) => (placeId ? `#/p/${placeSegment(placeId)}` : '#/'),
  hourly: (placeId: string) => `#/p/${placeSegment(placeId)}/hourly`,
  day: (placeId: string, index: number) => `#/p/${placeSegment(placeId)}/day/${index}`,
  metric: (placeId: string, metric: MetricKey) => `#/p/${placeSegment(placeId)}/metric/${metric}`,
  locations: () => '#/locations',
  settings: () => '#/settings',
};

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'today' };
  if (parts[0] === 'locations' && parts.length === 1) return { name: 'locations' };
  if (parts[0] === 'settings' && parts.length === 1) return { name: 'settings' };
  if (parts[0] === 'p' && parts[1]) {
    const placeId = placeIdFrom(parts[1]);
    if (parts.length === 2) return { name: 'today', placeId };
    if (parts[2] === 'hourly' && parts.length === 3) return { name: 'hourly', placeId };
    if (parts[2] === 'day' && parts.length === 4 && /^\d+$/.test(parts[3])) return { name: 'day', placeId, index: Number(parts[3]) };
    if (parts[2] === 'metric' && parts.length === 4 && isMetric(parts[3])) return { name: 'metric', placeId, metric: parts[3] };
  }
  return { name: 'notfound' };
}

/** A key that changes when the screen changes (used for page transitions and focus). */
export function routeKey(r: Route): string {
  switch (r.name) {
    case 'today':
      return `today:${r.placeId ?? ''}`;
    case 'hourly':
      return `hourly:${r.placeId}`;
    case 'day':
      return `day:${r.placeId}:${r.index}`;
    case 'metric':
      return `metric:${r.placeId}:${r.metric}`;
    default:
      return r.name;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) window.location.replace(to);
  else window.location.hash = to.replace(/^#/, '');
}
