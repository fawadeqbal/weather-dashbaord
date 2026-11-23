import { type ReactNode } from 'react';
import { AlertBanner, BackLink, GlassPanel, WeatherIcon, type IconName } from '../../design-system';
import type { ForecastState } from '../../weather/hooks';
import { localNow } from '../../weather/selectors';
import type { Forecast, Place } from '../../weather/types';
import { href } from '../router';
import { useApp } from '../store';

export interface PlaceForecast {
  place: Place | undefined;
  state: ForecastState | undefined;
  forecast: Forecast | undefined;
  nowLocal: string;
}

/** The saved place for an id (or the selected one), its forecast and its local time now. */
export function usePlaceForecast(placeId?: string): PlaceForecast {
  const { places, selectedId, states, now } = useApp();
  const id = placeId ?? selectedId;
  const place = places.find((p) => p.id === id);
  const state = place ? states[place.id] : undefined;
  const forecast = state?.forecast;
  return { place, state, forecast, nowLocal: forecast ? localNow(forecast, now) : '' };
}

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="page-head">
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      <div className="page-head-row">
        <div className="page-head-text">
          <h1 id="page-title" className="page-title" tabIndex={-1}>
            {title}
          </h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-head-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Shows loading and error states for a place, and the page once the forecast is in. */
export function ForecastGate({ pf, children }: { pf: PlaceForecast; children: (f: Forecast, nowLocal: string, place: Place) => ReactNode }) {
  const { reload } = useApp();
  const { place, state, forecast, nowLocal } = pf;
  if (!place) return <NotSaved />;
  return (
    <>
      {state?.status === 'error' ? (
        <div className="page-error" role="alert">
          <AlertBanner title={forecast ? 'Showing the last forecast' : `Could not load ${place.name}`}>{state.error}</AlertBanner>
          <button type="button" className="nb-text-btn" onClick={() => reload(place)}>
            Try again
          </button>
        </div>
      ) : null}
      {forecast ? children(forecast, nowLocal, place) : state?.status === 'error' ? null : <LoadingPanels />}
    </>
  );
}

export function LoadingPanels() {
  return (
    <div className="page-loading" aria-busy="true">
      <p className="nb-sr" role="status">Loading the forecast…</p>
      <GlassPanel className="nb-skeleton skel-hero" aria-hidden />
      <div className="skel-row">
        <GlassPanel className="nb-skeleton skel-block" aria-hidden />
        <GlassPanel className="nb-skeleton skel-block" aria-hidden />
      </div>
    </div>
  );
}

export function NotSaved() {
  return (
    <GlassPanel className="empty-panel">
      <h1 id="page-title" className="page-title" tabIndex={-1}>
        This city isn’t in your list
      </h1>
      <p className="empty-text">Add it from Locations to see its forecast.</p>
      <a className="nb-text-btn" href={href.locations()}>
        Go to Locations
      </a>
    </GlassPanel>
  );
}

/** A small labelled fact card: label, big value, one-line note. */
export function Fact({ icon, label, value, note }: { icon: IconName; label: string; value: string; note: string }) {
  return (
    <GlassPanel as="article" padding="md" radius="xl" className="fact">
      <h2 className="nb-label">
        <WeatherIcon condition={icon} size={15} strokeWidth={1.8} tinted={false} />
        {label}
      </h2>
      <p className="fact-value">{value}</p>
      <p className="fact-note">{note}</p>
    </GlassPanel>
  );
}
