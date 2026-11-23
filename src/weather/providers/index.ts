import { createMockProvider } from './mock';
import { createOpenMeteoProvider } from './openMeteo';
import type { WeatherProvider } from './types';

export type { WeatherProvider } from './types';
export { WeatherProviderError } from './types';

/**
 * Registry of available weather APIs. To add one (e.g. OpenWeatherMap):
 *   1. create providers/openWeatherMap.ts exporting createOpenWeatherMapProvider()
 *      that implements WeatherProvider and maps the API into types.ts;
 *   2. add it here;
 *   3. set VITE_WEATHER_PROVIDER=openweathermap.
 */
const PROVIDERS: Record<string, () => WeatherProvider> = {
  'open-meteo': createOpenMeteoProvider,
  mock: () => createMockProvider(),
};

export const DEFAULT_PROVIDER = 'open-meteo';

/**
 * Picks the provider: a `?provider=` URL parameter wins (handy for demos),
 * then VITE_WEATHER_PROVIDER, then Open-Meteo.
 */
export function resolveProviderId(search: string = typeof window !== 'undefined' ? window.location.search : '', envValue: string | undefined = import.meta.env.VITE_WEATHER_PROVIDER): string {
  const fromUrl = new URLSearchParams(search).get('provider');
  for (const candidate of [fromUrl, envValue]) {
    if (candidate && candidate in PROVIDERS) return candidate;
  }
  return DEFAULT_PROVIDER;
}

export function createProvider(id: string = resolveProviderId()): WeatherProvider {
  return (PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER])();
}

export const availableProviders = () => Object.keys(PROVIDERS);
