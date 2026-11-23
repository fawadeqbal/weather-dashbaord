import { useState, type ReactNode } from 'react';
import { GlassPanel, SegmentedControl, WeatherIcon } from '../../design-system';
import { IMPERIAL, METRIC, type UnitPrefs } from '../../weather/format';
import { DEFAULT_PLACES } from '../../weather/places';
import { availableProviders } from '../../weather/providers';
import { useApp } from '../store';
import { PageHeader } from './common';

export function SettingsPage() {
  const { prefs, setPrefs, provider, refreshAll, setPlaces, setSelectedId, showToast } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof UnitPrefs>(k: K) => (v: UnitPrefs[K]) => setPrefs({ ...prefs, [k]: v });
  const preset = sameAs(prefs, METRIC) ? 'metric' : sameAs(prefs, IMPERIAL) ? 'imperial' : 'custom';

  return (
    <div className="settings">
      <PageHeader title="Settings" subtitle="Saved on this device" />

      <GlassPanel aria-labelledby="units-h" className="settings-panel">
        <div className="settings-panel-head">
          <h2 id="units-h" className="settings-title">Units</h2>
          <div className="settings-presets">
            <button type="button" className="nb-text-btn" aria-pressed={preset === 'metric'} onClick={() => setPrefs({ ...METRIC, clock: prefs.clock })}>
              Metric
            </button>
            <button type="button" className="nb-text-btn" aria-pressed={preset === 'imperial'} onClick={() => setPrefs({ ...IMPERIAL, clock: prefs.clock })}>
              Imperial
            </button>
          </div>
        </div>
        <ul className="settings-list">
          <Row label="Temperature">
            <SegmentedControl label="Temperature" size="sm" value={prefs.temp} onChange={set('temp')} options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} />
          </Row>
          <Row label="Wind speed">
            <SegmentedControl label="Wind speed" size="sm" value={prefs.wind} onChange={set('wind')} options={[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }, { value: 'ms', label: 'm/s' }, { value: 'kn', label: 'kn' }]} />
          </Row>
          <Row label="Pressure">
            <SegmentedControl label="Pressure" size="sm" value={prefs.pressure} onChange={set('pressure')} options={[{ value: 'hPa', label: 'hPa' }, { value: 'inHg', label: 'inHg' }, { value: 'mmHg', label: 'mmHg' }]} />
          </Row>
          <Row label="Distance">
            <SegmentedControl label="Distance" size="sm" value={prefs.distance} onChange={set('distance')} options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} />
          </Row>
          <Row label="Precipitation">
            <SegmentedControl label="Precipitation" size="sm" value={prefs.precip} onChange={set('precip')} options={[{ value: 'mm', label: 'mm' }, { value: 'in', label: 'in' }]} />
          </Row>
          <Row label="Time">
            <SegmentedControl label="Time format" size="sm" value={prefs.clock} onChange={set('clock')} options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} />
          </Row>
        </ul>
      </GlassPanel>

      <GlassPanel aria-labelledby="data-h" className="settings-panel">
        <h2 id="data-h" className="settings-title">Weather data</h2>
        <ul className="settings-list">
          <Row label="Source" note={availableProviders().length > 1 ? 'Change with VITE_WEATHER_PROVIDER, or add ?provider=mock to the address for sample data.' : undefined}>
            <span className="settings-value">{provider.name}</span>
          </Row>
          <Row label="Updates" note="Forecasts refresh every 15 minutes, and when you come back to the app after that long.">
            <button
              type="button"
              className="nb-text-btn"
              onClick={() => {
                refreshAll();
                showToast('Refreshing all cities');
              }}
            >
              <WeatherIcon condition="refresh" size={16} strokeWidth={2} tinted={false} />
              Refresh now
            </button>
          </Row>
        </ul>
      </GlassPanel>

      <GlassPanel aria-labelledby="reset-h" className="settings-panel">
        <h2 id="reset-h" className="settings-title">Saved cities</h2>
        <ul className="settings-list">
          <Row label="Start over" note="Replaces your list with the five starter cities.">
            {confirmReset ? (
              <span className="settings-confirm">
                <button
                  type="button"
                  className="nb-text-btn nb-text-btn-danger"
                  onClick={() => {
                    setPlaces(DEFAULT_PLACES);
                    setSelectedId(DEFAULT_PLACES[0].id);
                    setConfirmReset(false);
                    showToast('Saved cities reset');
                  }}
                >
                  Reset list
                </button>
                <button type="button" className="nb-text-btn" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="nb-text-btn" onClick={() => setConfirmReset(true)}>
                Reset saved cities
              </button>
            )}
          </Row>
        </ul>
      </GlassPanel>

      <GlassPanel aria-labelledby="about-h" className="settings-panel">
        <h2 id="about-h" className="settings-title">About</h2>
        <p className="settings-about">
          Nimbus shows each city under a real sky that matches its weather. Weather data from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Sky photos from{' '}
          <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>. Icons adapted from{' '}
          <a href="https://lucide.dev/" target="_blank" rel="noreferrer">Lucide</a>.
        </p>
      </GlassPanel>
    </div>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <li className="settings-row">
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {note ? <span className="settings-row-note">{note}</span> : null}
      </span>
      <span className="settings-row-control">{children}</span>
    </li>
  );
}

function sameAs(a: UnitPrefs, b: UnitPrefs) {
  return a.temp === b.temp && a.wind === b.wind && a.pressure === b.pressure && a.distance === b.distance && a.precip === b.precip;
}
