import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { defaultPrefs, isUnitPrefs, makeFormat, type Format, type UnitPrefs } from '../weather/format';
import { useForecasts, useMinuteClock, useStoredState, type ForecastState } from '../weather/hooks';
import { DEFAULT_PLACES } from '../weather/places';
import type { WeatherProvider } from '../weather/providers';
import type { Place } from '../weather/types';

export interface ToastMessage {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface AppState {
  provider: WeatherProvider;
  places: Place[];
  setPlaces: (update: Place[] | ((p: Place[]) => Place[])) => void;
  selectedId: string;
  setSelectedId: (id: string) => void;
  prefs: UnitPrefs;
  setPrefs: (p: UnitPrefs) => void;
  fmt: Format;
  states: Record<string, ForecastState>;
  reload: (p: Place) => void;
  refreshAll: () => void;
  now: Date;
  toast: ToastMessage | null;
  showToast: (message: string, action?: ToastMessage['action']) => void;
  dismissToast: () => void;
}

const Ctx = createContext<AppState | null>(null);

const isString = (v: unknown): v is string => typeof v === 'string';
export const isPlaceList = (v: unknown): v is Place[] =>
  Array.isArray(v) &&
  v.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.latitude === 'number' && typeof p.longitude === 'number');

export function AppProvider({ provider, children }: { provider: WeatherProvider; children: ReactNode }) {
  const [places, setPlaces] = useStoredState<Place[]>('nimbus.places', DEFAULT_PLACES, isPlaceList);
  const [selectedId, setSelectedId] = useStoredState<string>('nimbus.selected', DEFAULT_PLACES[0].id, isString);
  const [prefs, setPrefs] = useStoredState<UnitPrefs>('nimbus.units', defaultPrefs(), isUnitPrefs);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const now = useMinuteClock();
  const { states, reload, refreshAll } = useForecasts(provider, places);
  const fmt = useMemo(() => makeFormat(prefs), [prefs]);

  const showToast = useCallback((message: string, action?: ToastMessage['action']) => setToast({ id: Date.now(), message, action }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const value: AppState = {
    provider,
    places,
    setPlaces,
    selectedId: places.some((p) => p.id === selectedId) ? selectedId : (places[0]?.id ?? ''),
    setSelectedId,
    prefs,
    setPrefs,
    fmt,
    states,
    reload,
    refreshAll,
    now,
    toast,
    showToast,
    dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
