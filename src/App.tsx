import { useMemo } from 'react';
import { Shell } from './app/Shell';
import { AppProvider } from './app/store';
import { createProvider, type WeatherProvider } from './weather/providers';

export interface AppProps {
  /** Inject a provider (tests, demos). Defaults to the configured one. */
  provider?: WeatherProvider;
}

export function App({ provider }: AppProps) {
  const weather = useMemo(() => provider ?? createProvider(), [provider]);
  return (
    <AppProvider provider={weather}>
      <Shell />
    </AppProvider>
  );
}
