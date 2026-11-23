import type { Forecast, Place } from '../types';

/**
 * A weather data source. To add another API, implement this interface in a new
 * file under providers/ and register it in providers/index.ts.
 */
export interface WeatherProvider {
  /** Short id used in config, e.g. "open-meteo". */
  readonly id: string;
  /** Name shown in the attribution line, e.g. "Open-Meteo". */
  readonly name: string;
  /** Full forecast for a place. Must reject with a WeatherProviderError on failure. */
  getForecast(place: Place, options?: { signal?: AbortSignal }): Promise<Forecast>;
  /** City search for the "add a city" box. Return [] when nothing matches. */
  searchPlaces(query: string, options?: { signal?: AbortSignal }): Promise<Place[]>;
}

export type ProviderErrorKind = 'network' | 'http' | 'parse' | 'not-found' | 'rate-limited' | 'unauthorized';

export class WeatherProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status?: number;

  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'WeatherProviderError';
    this.kind = kind;
    this.status = status;
  }
}

/** Fetches JSON and turns failures into WeatherProviderError. Shared by HTTP providers. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new WeatherProviderError('network', 'Could not reach the weather service. Check your connection and try again.');
  }
  if (!res.ok) {
    const kind = res.status === 429 ? 'rate-limited' : res.status === 401 || res.status === 403 ? 'unauthorized' : res.status === 404 ? 'not-found' : 'http';
    let detail = '';
    try {
      const body = (await res.json()) as { reason?: string; message?: string };
      detail = body.reason ?? body.message ?? '';
    } catch {
      /* body was not JSON */
    }
    throw new WeatherProviderError(kind, `The weather service answered ${res.status}${detail ? `: ${detail}` : ''}.`, res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new WeatherProviderError('parse', 'The weather service sent a response the app could not read.');
  }
}
