import { useEffect, useMemo, useState } from 'react';
import {
  AlertBanner,
  CityCard,
  CurrentConditions,
  DailyForecast,
  GlassPanel,
  HourlyChart,
  IconButton,
  MetricTile,
  PressureGauge,
  RangeMeter,
  SearchField,
  SkyBackdrop,
  SunArc,
  UnitToggle,
  WeatherIcon,
  WindCompass,
  formatTemp,
  type Unit,
} from './design-system';
import { useForecasts, useMinuteClock, usePlaceSearch, useStoredState, type ForecastState } from './weather/hooks';
import { DEFAULT_PLACES, matchesPlace } from './weather/places';
import { createProvider, type WeatherProvider } from './weather/providers';
import { presentForecast, type ForecastView } from './weather/present';
import { ALL_PHOTOS, PHOTOS } from './weather/scenes';
import { formatUpdated } from './weather/time';
import type { Place } from './weather/types';

const isUnit = (v: unknown): v is Unit => v === 'C' || v === 'F';
const isString = (v: unknown): v is string => typeof v === 'string';
const isPlaceList = (v: unknown): v is Place[] =>
  Array.isArray(v) && v.length > 0 && v.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.latitude === 'number' && typeof p.longitude === 'number');

/** Fahrenheit for US-style locales, Celsius everywhere else. */
function defaultUnit(): Unit {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return /^en-(US|LR|MM)$|^(my|en-BS|en-BZ|en-KY|en-PW)/.test(lang) ? 'F' : 'C';
}

export interface AppProps {
  /** Inject a provider (tests, storybooks). Defaults to the configured one. */
  provider?: WeatherProvider;
}

export function App({ provider }: AppProps) {
  const weather = useMemo(() => provider ?? createProvider(), [provider]);
  const [places, setPlaces] = useStoredState<Place[]>('nimbus.places', DEFAULT_PLACES, isPlaceList);
  const [selectedId, setSelectedId] = useStoredState<string>('nimbus.selected', DEFAULT_PLACES[0].id, isString);
  const [unit, setUnit] = useStoredState<Unit>('nimbus.unit', defaultUnit(), isUnit);
  const [query, setQuery] = useState('');
  const now = useMinuteClock();

  const { states, reload, refreshAll } = useForecasts(weather, places);
  const search = usePlaceSearch(weather, query);

  const selected = places.find((p) => p.id === selectedId) ?? places[0];
  const state: ForecastState | undefined = states[selected.id];
  const view = state?.forecast ? presentForecast(state.forecast, unit, now) : null;

  const matching = places.filter((p) => matchesPlace(p, query));
  const savedIds = new Set(places.map((p) => p.id));
  const additions = search.results.filter((r) => !savedIds.has(r.id));

  useEffect(() => {
    document.title = `${selected.name} · Nimbus`;
  }, [selected.name]);

  const addPlace = (p: Place) => {
    setPlaces((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    setSelectedId(p.id);
    setQuery('');
  };
  const removeSelected = () => {
    if (places.length < 2) return;
    const rest = places.filter((p) => p.id !== selected.id);
    setPlaces(rest);
    setSelectedId(rest[0].id);
  };

  const busy = Object.values(states).some((s) => s.status === 'loading');

  return (
    <SkyBackdrop
      scene={view?.scene ?? 'clear'}
      photo={view?.photo ?? PHOTOS.sunny}
      photos={ALL_PHOTOS}
      precip={view?.precip}
      scrim={view?.scrim ?? 'normal'}
      className="app-sky"
    >
      <div className="app">
        <GlassPanel as="aside" className="app-sidebar" aria-label="My cities">
          <div className="app-brand">
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
              <circle cx="13" cy="13" r="7" fill="var(--scene-clear)" />
              <path d="M10 27h13a5 5 0 0 0 0-10 7 7 0 0 0-13.4 2.2A4 4 0 0 0 10 27Z" fill="var(--ink)" fillOpacity="0.94" />
            </svg>
            <span className="wordmark">Nimbus</span>
          </div>

          <SearchField id="city-search" label="Search or add a city" placeholder="Search or add a city" value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="app-list-head">
            <h2 className="nb-label">My cities</h2>
            <span className="nb-caption">{places.length} saved</span>
          </div>

          <ul className="app-cities">
            {matching.map((p) => (
              <li key={p.id}>
                <CityCardFor place={p} state={states[p.id]} unit={unit} now={now} selected={p.id === selected.id} onSelect={() => setSelectedId(p.id)} />
              </li>
            ))}
          </ul>
          {query && !matching.length && !additions.length && search.status !== 'searching' ? (
            <p className="app-note">No city matches “{query}”.</p>
          ) : null}

          {query.trim().length >= 2 ? (
            <section className="app-add" aria-label="Add a city">
              <h2 className="nb-label">Add a city</h2>
              {search.status === 'searching' ? <p className="app-note">Searching…</p> : null}
              {search.status === 'error' ? <p className="app-note">City search is not available right now.</p> : null}
              <ul className="app-results">
                {additions.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="app-result" onClick={() => addPlace(p)}>
                      <WeatherIcon condition="add" size={18} tinted={false} />
                      <span>
                        <span className="app-result-name">{p.name}</span>
                        <span className="app-result-where">{[p.region, p.country].filter(Boolean).join(', ')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="app-sidebar-foot">
            {places.length > 1 ? (
              <button type="button" className="nb-text-btn" onClick={removeSelected}>
                Remove {selected.name}
              </button>
            ) : null}
            <p className="app-credit">
              Weather data:{' '}
              {state?.forecast?.source.url ? (
                <a href={state.forecast.source.url} target="_blank" rel="noreferrer">{state.forecast.source.name}</a>
              ) : (
                weather.name
              )}
              . Photos: <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>.
            </p>
          </div>
        </GlassPanel>

        <main className="app-main">
          <header className="app-header">
            <div className="app-title">
              <p className="app-dateline">{view ? `${view.localDate} · ${view.localTime} local time` : 'Loading local time…'}</p>
              <h1 className="city-title">
                {selected.name}
                <span className="app-country">{selected.country}</span>
              </h1>
            </div>
            <div className="app-actions">
              {state?.forecast ? (
                <span className="app-updated">
                  <span className="app-live" aria-hidden />
                  {formatUpdated(state.forecast.fetchedAt, now)}
                </span>
              ) : null}
              <IconButton icon="refresh" label="Refresh forecasts" onClick={refreshAll} disabled={busy} spinning={busy} />
              <UnitToggle value={unit} onChange={setUnit} />
            </div>
          </header>

          {state?.status === 'error' ? (
            <div className="app-error" role="alert">
              <AlertBanner title={state.forecast ? 'Showing the last forecast' : `Could not load ${selected.name}`}>{state.error}</AlertBanner>
              <button type="button" className="nb-text-btn" onClick={() => reload(selected)}>
                Try again
              </button>
            </div>
          ) : null}

          {view ? <ForecastBody view={view} unit={unit} /> : state?.status !== 'error' ? <LoadingBody /> : null}
        </main>
      </div>
    </SkyBackdrop>
  );
}

function CityCardFor({ place, state, unit, now, selected, onSelect }: { place: Place; state?: ForecastState; unit: Unit; now: Date; selected: boolean; onSelect: () => void }) {
  if (!state?.forecast) {
    return (
      <CityCard
        name={place.name}
        condition="cloud"
        conditionLabel={state?.status === 'error' ? 'Unavailable' : 'Loading…'}
        temp="—"
        scene="clear"
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  const v = presentForecast(state.forecast, unit, now);
  return (
    <CityCard
      name={place.name}
      localTime={v.card.localTime}
      condition={v.hero.condition}
      conditionLabel={v.hero.conditionLabel}
      temp={v.card.temp}
      high={v.card.high}
      low={v.card.low}
      photo={v.photo.src}
      photoPosition={v.photo.position}
      scene={v.scene}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function ForecastBody({ view, unit }: { view: ForecastView; unit: Unit }) {
  return (
    <>
      {view.alert ? (
        <AlertBanner title={view.alert.title} icon={/aurora/i.test(view.alert.title) ? 'aurora' : 'alert'}>
          {view.alert.description}
        </AlertBanner>
      ) : null}

      <CurrentConditions {...view.hero} />

      <div className="app-row">
        <div className="app-row-wide">
          <HourlyChart hours={view.hours} unitLabel={unit === 'F' ? '°F' : '°C'} />
        </div>
        <div className="app-row-narrow">
          <DailyForecast days={view.days} />
        </div>
      </div>

      <section className="app-tiles" aria-label="Conditions in detail">
        <MetricTile
          label="Wind"
          icon="wind"
          value={view.wind.value}
          unit={view.wind.unit}
          visual={<WindCompass degrees={view.wind.degrees} label={`Wind ${view.wind.fromWords}`} />}
          caption={view.wind.gusts}
        >
          <span className="app-tile-line">From {view.wind.from}</span>
        </MetricTile>

        {view.uv ? (
          <MetricTile label="UV index" icon="sun" value={view.uv.value} qualifier={view.uv.label} caption={view.uv.advice}>
            <RangeMeter scale="uv" value={view.uv.value} label={`UV index ${view.uv.value}, ${view.uv.label.toLowerCase()}`} />
          </MetricTile>
        ) : (
          <MetricTile label="UV index" icon="sun" value="—" caption="UV data is not available for this place." />
        )}

        <MetricTile label="Humidity" icon="humidity" value={`${view.humidity.value}%`} caption={`Dew point ${formatTemp(view.humidity.dewPoint)} right now`}>
          <RangeMeter value={view.humidity.value} label={`Humidity ${view.humidity.value}%`} />
        </MetricTile>

        {view.sun ? (
          <MetricTile label="Sunrise & sunset" icon="sunrise" caption={view.sun.note}>
            <SunArc progress={view.sun.progress} sunrise={view.sun.sunrise} sunset={view.sun.sunset} />
          </MetricTile>
        ) : (
          <MetricTile label="Sunrise & sunset" icon="sunrise" value="—" caption="No sunrise or sunset today at this latitude." />
        )}

        {view.aqi ? (
          <MetricTile label="Air quality" icon="air-quality" value={view.aqi.value} qualifier={view.aqi.label} caption={view.aqi.advice}>
            <RangeMeter scale="aqi" value={view.aqi.value} label={`Air quality index ${view.aqi.value}, ${view.aqi.label.toLowerCase()}`} />
          </MetricTile>
        ) : (
          <MetricTile label="Air quality" icon="air-quality" value="—" caption="Air quality data is not available for this place." />
        )}

        <MetricTile label="Pressure" icon="pressure" value={view.pressure.value} visual={<PressureGauge hpa={view.pressure.hpa} />}>
          <span className="app-tile-line">
            {view.pressure.unit} · {view.pressure.trend}
          </span>
        </MetricTile>
      </section>
    </>
  );
}

function LoadingBody() {
  return (
    <div className="app-loading" aria-busy="true">
      <p className="nb-sr" role="status">Loading the forecast…</p>
      <GlassPanel className="nb-skeleton app-skel-hero" aria-hidden />
      <div className="app-row">
        <GlassPanel className="nb-skeleton app-skel-wide" aria-hidden />
        <GlassPanel className="nb-skeleton app-skel-narrow" aria-hidden />
      </div>
    </div>
  );
}
