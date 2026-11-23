import { useEffect, useRef } from 'react';
import { IconButton, SegmentedControl, SkyBackdrop, TabBar, Toast, type NavItem } from '../design-system';
import { withTemp, type TempUnit } from '../weather/format';
import { ALL_PHOTOS, PHOTOS } from '../weather/scenes';
import { localNow, sceneFor } from '../weather/selectors';
import { formatUpdated } from '../weather/time';
import { DayPage } from './pages/DayPage';
import { HourlyPage } from './pages/HourlyPage';
import { LocationsPage } from './pages/LocationsPage';
import { METRIC_LABEL, MetricPage } from './pages/MetricPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { href, routeKey, useRoute, type Route } from './router';
import { useApp } from './store';

export function Shell() {
  const route = useRoute();
  const app = useApp();
  const { places, selectedId, states, now, prefs, setPrefs, refreshAll, toast, dismissToast } = app;

  const activeId = 'placeId' in route && route.placeId ? route.placeId : selectedId;
  const active = places.find((p) => p.id === activeId);
  const f = states[activeId]?.forecast;
  const scene = f ? sceneFor(f, localNow(f, now)) : null;
  const busy = Object.values(states).some((s) => s.status === 'loading');
  const key = routeKey(route);

  // On each new screen: scroll to the top and move focus to its heading.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById('page-title')?.focus({ preventScroll: true }));
  }, [key]);

  useEffect(() => {
    document.title = `${titleFor(route, active?.name)} · Nimbus`;
  }, [route, active?.name]);

  const onWeather = route.name === 'today' || route.name === 'hourly' || route.name === 'day' || route.name === 'metric';
  const nav: NavItem[] = [
    { href: href.today(selectedId || undefined), label: 'Today', icon: 'today', active: onWeather },
    { href: href.locations(), label: 'Locations', icon: 'list', active: route.name === 'locations' },
    { href: href.settings(), label: 'Settings', icon: 'settings', active: route.name === 'settings' },
  ];

  return (
    <SkyBackdrop
      scene={scene?.scene ?? 'clear'}
      photo={scene?.photoLayer ?? PHOTOS.sunny}
      photos={ALL_PHOTOS}
      precip={scene?.precip}
      scrim={scene?.scrim ?? 'normal'}
      className="shell"
    >
      <a
        className="skip-link"
        href="#page-title"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('page-title')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href={href.today(selectedId || undefined)} aria-label="Nimbus, today">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
            <circle cx="13" cy="13" r="7" fill="var(--scene-clear)" />
            <path d="M10 27h13a5 5 0 0 0 0-10 7 7 0 0 0-13.4 2.2A4 4 0 0 0 10 27Z" fill="var(--ink)" fillOpacity="0.94" />
          </svg>
          <span className="wordmark">Nimbus</span>
        </a>
        <TabBar items={nav} />
        <div className="topbar-actions">
          {f ? <span className="topbar-updated"><span className="live-dot" aria-hidden />{formatUpdated(f.fetchedAt, now)}</span> : null}
          <IconButton icon="refresh" label="Refresh forecasts" onClick={refreshAll} disabled={busy} spinning={busy} />
          <SegmentedControl<TempUnit>
            label="Temperature unit"
            size="sm"
            value={prefs.temp}
            onChange={(t) => setPrefs(withTemp(prefs, t))}
            options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]}
          />
        </div>
      </header>

      <main className="page" key={key}>
        <Page route={route} />
      </main>

      <footer className="credit">
        Weather data: {f?.source.url ? <a href={f.source.url} target="_blank" rel="noreferrer">{f.source.name}</a> : app.provider.name}. Photos:{' '}
        <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>.
      </footer>

      {toast ? <Toast key={toast.id} message={toast.message} action={toast.action} onDismiss={dismissToast} /> : null}
    </SkyBackdrop>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
      return <TodayPage placeId={route.placeId} />;
    case 'hourly':
      return <HourlyPage placeId={route.placeId} />;
    case 'day':
      return <DayPage placeId={route.placeId} index={route.index} />;
    case 'metric':
      return <MetricPage placeId={route.placeId} metric={route.metric} />;
    case 'locations':
      return <LocationsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return (
        <div className="empty-panel nb-glass nb-r-2xl nb-pad-lg">
          <h1 id="page-title" className="page-title" tabIndex={-1}>Page not found</h1>
          <p className="empty-text">That address doesn’t match a screen in Nimbus.</p>
          <a className="nb-text-btn" href="#/">Go to Today</a>
        </div>
      );
  }
}

function titleFor(route: Route, placeName?: string): string {
  const p = placeName ?? 'Weather';
  switch (route.name) {
    case 'today':
      return p;
    case 'hourly':
      return `Hourly · ${p}`;
    case 'day':
      return `Day · ${p}`;
    case 'metric':
      return `${METRIC_LABEL[route.metric].title} · ${p}`;
    case 'locations':
      return 'Locations';
    case 'settings':
      return 'Settings';
    default:
      return 'Not found';
  }
}
