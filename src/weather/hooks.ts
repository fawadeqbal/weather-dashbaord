import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WeatherProvider } from './providers';
import type { DailyWeather, Forecast, Place } from './types';

export type ForecastState =
  | { status: 'loading'; forecast?: Forecast }
  | { status: 'ready'; forecast: Forecast }
  | { status: 'error'; error: string; forecast?: Forecast };

/** How long a forecast stays fresh before an automatic refresh. */
export const REFRESH_MS = 15 * 60 * 1000;

/**
 * Loads a forecast for every place, keeps the last good forecast while
 * refreshing, refreshes every 15 minutes and when the tab becomes visible
 * again after that long.
 */
export function useForecasts(provider: WeatherProvider, places: Place[]) {
  const [states, setStates] = useState<Record<string, ForecastState>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const lastLoaded = useRef(0);

  const load = useCallback(
    (place: Place) => {
      controllers.current.get(place.id)?.abort();
      const ctrl = new AbortController();
      controllers.current.set(place.id, ctrl);
      setStates((s) => ({ ...s, [place.id]: { status: 'loading', forecast: s[place.id]?.forecast } }));
      provider
        .getForecast(place, { signal: ctrl.signal })
        .then((forecast) => {
          if (!ctrl.signal.aborted) setStates((s) => ({ ...s, [place.id]: { status: 'ready', forecast } }));
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return;
          const message = err instanceof Error ? err.message : 'Something went wrong loading the forecast.';
          setStates((s) => ({ ...s, [place.id]: { status: 'error', error: message, forecast: s[place.id]?.forecast } }));
        });
    },
    [provider],
  );

  const refreshAll = useCallback(() => {
    lastLoaded.current = Date.now();
    places.forEach(load);
  }, [places, load]);

  // Load places we have not loaded yet (on mount and when a city is added).
  const placeKey = places.map((p) => p.id).join('|');
  useEffect(() => {
    places.forEach((p) => {
      if (!states[p.id]) load(p);
    });
    if (!lastLoaded.current) lastLoaded.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, load]);

  // Periodic and on-return refresh.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoaded.current >= REFRESH_MS) refreshAll();
    };
    const id = window.setInterval(tick, 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    // Coming back online: refresh straight away.
    window.addEventListener('online', refreshAll);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', refreshAll);
    };
  }, [refreshAll]);

  // Abort everything on unmount.
  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  return { states, reload: load, refreshAll };
}

export type OutlookState =
  | { status: 'unsupported' }
  | { status: 'loading' }
  | { status: 'ready'; days: DailyWeather[] }
  | { status: 'error'; error: string };

const outlookCache = new Map<string, { at: number; days: DailyWeather[] }>();

/** The long-range daily forecast for one place, fetched when a screen asks for it and kept for 30 minutes. */
export function useOutlook(provider: WeatherProvider, place: Place | undefined): OutlookState & { retry: () => void } {
  const key = place ? `${provider.id}:${place.id}` : '';
  const cached = outlookCache.get(key);
  const fresh = cached && Date.now() - cached.at < 2 * REFRESH_MS;
  const [state, setState] = useState<OutlookState>(() =>
    !provider.getOutlook ? { status: 'unsupported' } : fresh ? { status: 'ready', days: cached.days } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!place || !provider.getOutlook) {
      setState({ status: 'unsupported' });
      return;
    }
    const hit = outlookCache.get(key);
    if (hit && Date.now() - hit.at < 2 * REFRESH_MS) {
      setState({ status: 'ready', days: hit.days });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    provider
      .getOutlook(place, { signal: ctrl.signal })
      .then((days) => {
        outlookCache.set(key, { at: Date.now(), days });
        if (!ctrl.signal.aborted) setState({ status: 'ready', days });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return;
        setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not load the outlook.' });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** True while the browser reports a network connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Debounced place search through the provider's geocoder. */
export function usePlaceSearch(provider: WeatherProvider, query: string, delayMs = 300) {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const ctrl = new AbortController();
    setStatus('searching');
    const timer = window.setTimeout(() => {
      provider
        .searchPlaces(q, { signal: ctrl.signal })
        .then((r) => {
          setResults(r);
          setStatus('done');
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === 'AbortError') return;
          setResults([]);
          setStatus('error');
        });
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [provider, query, delayMs]);

  return { results, status };
}

/** useState that persists to localStorage. Storage failures (private mode) fall back to memory. */
export function useStoredState<T>(key: string, initial: T, validate?: (v: unknown) => v is T) {
  const first = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        const parsed: unknown = JSON.parse(raw);
        if (!validate || validate(parsed)) return parsed as T;
      }
    } catch {
      /* ignore */
    }
    return initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [value, setValue] = useState<T>(first);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Re-renders every minute so "Updated 3 min ago" stays true. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
