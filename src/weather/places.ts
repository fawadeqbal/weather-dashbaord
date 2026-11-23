import type { Place } from './types';

/** The cities a new visitor starts with. Ids are GeoNames ids, as Open-Meteo geocoding returns them. */
export const DEFAULT_PLACES: Place[] = [
  { id: 'geo:5391959', name: 'San Francisco', country: 'United States', region: 'California', latitude: 37.77493, longitude: -122.41942, timezone: 'America/Los_Angeles' },
  { id: 'geo:1850147', name: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.69171, timezone: 'Asia/Tokyo' },
  { id: 'geo:2147714', name: 'Sydney', country: 'Australia', region: 'New South Wales', latitude: -33.86785, longitude: 151.20732, timezone: 'Australia/Sydney' },
  { id: 'geo:2643743', name: 'London', country: 'United Kingdom', region: 'England', latitude: 51.50853, longitude: -0.12574, timezone: 'Europe/London' },
  { id: 'geo:3413829', name: 'Reykjavík', country: 'Iceland', region: 'Capital Region', latitude: 64.13548, longitude: -21.89541, timezone: 'Atlantic/Reykjavik' },
];

/** Lower-cased, accent-free text for matching ("Reykjavík" ~ "reykjavik"). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function matchesPlace(place: Place, query: string): boolean {
  const q = normalize(query);
  return !q || normalize(`${place.name} ${place.region ?? ''} ${place.country}`).includes(q);
}
