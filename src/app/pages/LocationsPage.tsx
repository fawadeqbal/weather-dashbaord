import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CityCard, GlassPanel, SearchField, WeatherIcon, cx } from '../../design-system';
import { usePlaceSearch, type ForecastState } from '../../weather/hooks';
import { matchesPlace } from '../../weather/places';
import { localNow, sceneFor, todayRange } from '../../weather/selectors';
import type { Place } from '../../weather/types';
import { href, navigate } from '../router';
import { useApp } from '../store';
import { PageHeader } from './common';

export function LocationsPage() {
  const { places, setPlaces, states, provider, showToast, selectedId, setSelectedId, startOn } = useApp();
  const [locError, setLocError] = useState<'denied' | 'failed' | 'unsupported' | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [locating, setLocating] = useState(false);
  const search = usePlaceSearch(provider, query);

  const saved = new Set(places.map((p) => p.id));
  const additions = search.results.filter((r) => !saved.has(r.id));
  const visible = editing ? places : places.filter((p) => matchesPlace(p, query));

  const add = (p: Place) => {
    setPlaces((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    setQuery('');
    showToast(`Added ${p.name}`, { label: 'View', onClick: () => navigate(href.today(p.id)) });
  };

  const remove = (p: Place) => {
    const at = places.findIndex((x) => x.id === p.id);
    const rest = places.filter((x) => x.id !== p.id);
    setPlaces(rest);
    if (selectedId === p.id && rest[0]) setSelectedId(rest[0].id);
    showToast(`Removed ${p.name}`, {
      label: 'Undo',
      onClick: () =>
        setPlaces((list) => {
          if (list.some((x) => x.id === p.id)) return list;
          const copy = [...list];
          copy.splice(Math.min(at, copy.length), 0, p);
          return copy;
        }),
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= places.length || from === to) return;
    setPlaces((list) => {
      const copy = [...list];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
    setAnnounce(`${places[from].name} moved to position ${to + 1} of ${places.length}.`);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocError('unsupported');
      return;
    }
    setLocError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here: Place = {
          id: 'here',
          name: 'My location',
          country: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setPlaces((list) => [here, ...list.filter((p) => p.id !== 'here')]);
        navigate(href.today('here'));
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <div className="locations">
      <PageHeader
        title="Locations"
        subtitle={`${places.length} saved · ${editing ? 'Drag or use the arrow keys to reorder' : startOn === 'first' ? 'The first city opens when you start Nimbus' : 'Nimbus reopens on the city you viewed last'}`}
        actions={
          places.length ? (
            <>
            {places.length > 1 && !editing ? (
              <a className="nb-text-btn" href={href.compare()}>
                <WeatherIcon condition="list" size={16} strokeWidth={2} tinted={false} />
                Compare
              </a>
            ) : null}
            <button type="button" className={cx('nb-text-btn', editing && 'nb-text-btn-on')} onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              <WeatherIcon condition={editing ? 'check' : 'edit'} size={16} strokeWidth={2} tinted={false} />
              {editing ? 'Done' : 'Edit'}
            </button>
            </>
          ) : null
        }
      />

      {!editing ? (
        <GlassPanel className="loc-search" padding="md">
          <SearchField id="loc-search" label="Search or add a city" placeholder="Search or add a city" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="loc-here" onClick={useMyLocation} disabled={locating}>
            <WeatherIcon condition="locate" size={18} strokeWidth={1.8} tinted={false} className={locating ? 'nb-spin' : undefined} />
            {locating ? 'Finding you…' : 'Use my current location'}
          </button>
          {query.trim().length >= 2 ? (
            <div className="loc-results" aria-live="polite">
              <h2 className="nb-label">Add a city</h2>
              {search.status === 'searching' ? <p className="loc-note">Searching…</p> : null}
              {search.status === 'error' ? <p className="loc-note">City search is not available right now.</p> : null}
              {search.status === 'done' && !additions.length ? <p className="loc-note">No other cities match “{query.trim()}”.</p> : null}
              <ul className="loc-result-list">
                {additions.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="loc-result" onClick={() => add(p)}>
                      <span className="loc-result-text">
                        <span className="loc-result-name">{p.name}</span>
                        <span className="loc-result-where">{[p.region, p.country].filter(Boolean).join(', ')}</span>
                      </span>
                      <span className="loc-result-add">
                        <WeatherIcon condition="add" size={16} strokeWidth={2} tinted={false} />
                        Add
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassPanel>
      ) : null}

      {locError && !editing ? <LocationHelp kind={locError} onRetry={useMyLocation} onClose={() => setLocError(null)} /> : null}

      {places.length === 0 ? (
        <GlassPanel className="empty-panel">
          <WeatherIcon condition="list" size={28} tinted={false} />
          <p className="empty-text">No saved cities yet. Search above to add one, or use your current location.</p>
        </GlassPanel>
      ) : null}

      {query && !editing && places.length > 0 && !visible.length ? <p className="loc-note">None of your saved cities match.</p> : null}

      {editing ? (
        <EditList places={places} states={states} onMove={move} onRemove={remove} />
      ) : (
        <ul className="loc-list" aria-label="Saved cities">
          {visible.map((p, i) => (
            <li key={p.id} className="loc-item" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <PlaceCard place={p} state={states[p.id]} selected={p.id === selectedId} />
              {states[p.id]?.forecast?.alerts.length ? (
                <a className="loc-warn" href={href.alert(p.id)} aria-label={`${p.name}: ${states[p.id]!.forecast!.alerts[0].title}`}>
                  <WeatherIcon condition="alert" size={14} strokeWidth={2} tinted={false} />
                  Warning
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="nb-sr" aria-live="assertive">{announce}</p>
    </div>
  );
}

function PlaceCard({ place, state, selected }: { place: Place; state?: ForecastState; selected: boolean }) {
  const { fmt, now } = useApp();
  const f = state?.forecast;
  if (!f) {
    return <CityCard href={href.today(place.id)} name={place.name} condition="cloud" conditionLabel={state?.status === 'error' ? 'Unavailable' : 'Loading…'} temp="—" scene="clear" selected={selected} />;
  }
  const nowLocal = localNow(f, now);
  const scene = sceneFor(f, nowLocal);
  const r = todayRange(f, nowLocal);
  return (
    <CityCard
      href={href.today(place.id)}
      name={place.name}
      localTime={fmt.clock(nowLocal)}
      condition={f.current.condition}
      conditionLabel={f.current.conditionLabel}
      temp={fmt.tempValue(f.current.tempC)}
      high={fmt.tempValue(r.maxC)}
      low={fmt.tempValue(r.minC)}
      photo={scene.photoLayer.src}
      photoPosition={scene.photoLayer.position}
      scene={scene.scene}
      selected={selected}
    />
  );
}

/** Reorderable list: drag the handle, or focus it and press the arrow keys. */
function EditList({ places, states, onMove, onRemove }: { places: Place[]; states: Record<string, ForecastState>; onMove: (from: number, to: number) => void; onRemove: (p: Place) => void }) {
  const { fmt, now, startOn } = useApp();
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number; rowH: number; from: number } | null>(null);

  const start = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    const row = (e.currentTarget.closest('li') as HTMLElement | null)?.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: places[i].id, startY: e.clientY, dy: 0, rowH: (row?.height ?? 64) + 10, from: i });
  };
  const moveTo = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const current = places.findIndex((p) => p.id === drag.id);
    const target = Math.max(0, Math.min(places.length - 1, drag.from + Math.round(dy / drag.rowH)));
    if (target !== current) onMove(current, target);
    setDrag({ ...drag, dy });
  };
  const end = () => setDrag(null);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
      onMove(i, to);
      requestAnimationFrame(() => listRef.current?.querySelectorAll<HTMLButtonElement>('.loc-grip')[Math.max(0, Math.min(places.length - 1, to))]?.focus());
    }
  };

  return (
    <ol className="loc-edit" ref={listRef} aria-label="Reorder or remove saved cities">
      {places.map((p, i) => {
        const f = states[p.id]?.forecast;
        const dragging = drag?.id === p.id;
        const offset = dragging ? drag.dy - (i - drag.from) * drag.rowH : 0;
        return (
          <li key={p.id} className={cx('loc-edit-row nb-glass', dragging && 'loc-edit-dragging')} style={dragging ? { transform: `translateY(${offset}px) scale(1.02)` } : undefined}>
            <button
              type="button"
              className="loc-grip"
              aria-label={`Reorder ${p.name}, position ${i + 1} of ${places.length}. Use the up and down arrow keys.`}
              onPointerDown={(e) => start(e, i)}
              onPointerMove={moveTo}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => onKey(e, i)}
            >
              <WeatherIcon condition="grip" size={20} strokeWidth={2.6} tinted={false} />
            </button>
            <span className="loc-edit-text">
              <span className="loc-edit-name">
                {p.name}
                {i === 0 && startOn === 'first' ? <span className="loc-badge">Opens first</span> : null}
              </span>
              <span className="loc-edit-where">{[p.region, p.country].filter(Boolean).join(', ')}</span>
            </span>
            <span className="loc-edit-temp">{f ? fmt.temp(f.current.tempC) : '—'}</span>
            <span className="loc-edit-moves">
              <button type="button" className="nb-icon-btn loc-mini" onClick={() => onMove(i, i - 1)} disabled={i === 0} aria-label={`Move ${p.name} up`}>
                <WeatherIcon condition="arrow-up" size={16} strokeWidth={2} tinted={false} />
              </button>
              <button type="button" className="nb-icon-btn loc-mini" onClick={() => onMove(i, i + 1)} disabled={i === places.length - 1} aria-label={`Move ${p.name} down`}>
                <WeatherIcon condition="arrow-down" size={16} strokeWidth={2} tinted={false} />
              </button>
            </span>
            <button type="button" className="nb-icon-btn loc-remove" onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`}>
              <WeatherIcon condition="trash" size={18} strokeWidth={1.8} tinted={false} />
            </button>
            <span className="nb-sr">{f ? `Local time ${fmt.clock(localNow(f, now))}` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Says why "Use my current location" failed and how to fix it, with a retry in reach. */
function LocationHelp({ kind, onRetry, onClose }: { kind: 'denied' | 'failed' | 'unsupported'; onRetry: () => void; onClose: () => void }) {
  return (
    <GlassPanel className="loc-help" role="alert" aria-labelledby="loc-help-h">
      <div className="loc-help-head">
        <WeatherIcon condition="locate" size={22} strokeWidth={1.8} tinted={false} />
        <h2 id="loc-help-h" className="settings-title">
          {kind === 'denied' ? 'Location is turned off for Nimbus' : kind === 'unsupported' ? 'This browser can’t share your location' : 'Couldn’t find your location'}
        </h2>
        <button type="button" className="nb-icon-btn loc-mini" onClick={onClose} aria-label="Close">
          <WeatherIcon condition="close" size={16} strokeWidth={2} tinted={false} />
        </button>
      </div>
      {kind === 'denied' ? (
        <ol className="loc-help-steps">
          <li>Click the lock or settings icon next to the address bar.</li>
          <li>Set <strong>Location</strong> to <strong>Allow</strong> for this site.</li>
          <li>Come back here and press <strong>Try again</strong>.</li>
        </ol>
      ) : (
        <p className="empty-text">
          {kind === 'unsupported' ? 'Search for your city above instead; it works just as well.' : 'Your device didn’t answer in time. Check that location services are on, then try again, or search for your city above.'}
        </p>
      )}
      {kind !== 'unsupported' ? (
        <button type="button" className="nb-text-btn nb-text-btn-on" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </GlassPanel>
  );
}
