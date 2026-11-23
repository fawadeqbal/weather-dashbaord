import { useState } from 'react';
import { GlassPanel, SegmentedControl, WeatherIcon, cx } from '../../design-system';
import type { Format } from '../../weather/format';
import { localNow, todayRange, dayIndexOf } from '../../weather/selectors';
import type { Forecast, Place } from '../../weather/types';
import { aqiLabel, compassPoint } from '../../weather/units';
import { href } from '../router';
import { useApp } from '../store';
import { PageHeader } from './common';

type CompareKey = 'temp' | 'rain' | 'wind' | 'air';

const OPTIONS: { value: CompareKey; label: string }[] = [
  { value: 'temp', label: 'Temp' },
  { value: 'rain', label: 'Rain' },
  { value: 'wind', label: 'Wind' },
  { value: 'air', label: 'Air' },
];

interface Row {
  place: Place;
  f?: Forecast;
  nowLocal?: string;
  value: number | null;
  text: string;
  sub: string;
}

export function ComparePage() {
  const { places, states, now, fmt } = useApp();
  const [key, setKey] = useState<CompareKey>('temp');

  const rows: Row[] = places.map((place) => {
    const f = states[place.id]?.forecast;
    if (!f) return { place, value: null, text: '…', sub: states[place.id]?.status === 'error' ? 'Could not load' : 'Loading' };
    const nowLocal = localNow(f, now);
    return { place, f, nowLocal, ...measure(key, f, nowLocal, fmt) };
  });
  const values = rows.map((r) => r.value).filter((v): v is number => v != null);
  const lo = key === 'temp' ? Math.min(...values) : 0;
  const hi = Math.max(...values, key === 'rain' ? 100 : key === 'air' ? 100 : lo + 1);
  const best = pickBest(key, rows);

  return (
    <div className="detail">
      <PageHeader title="Compare cities" subtitle={`${places.length} saved cities, side by side`} back={{ href: href.locations(), label: 'Locations' }} />

      <div className="compare-controls">
        <SegmentedControl<CompareKey> label="Compare by" value={key} onChange={setKey} options={OPTIONS} />
      </div>

      {best ? <p className="compare-answer">{best}</p> : null}

      <GlassPanel padding="md">
        <ul className="compare-list">
          {rows.map((r) => (
            <li key={r.place.id}>
              <a className="compare-row" href={href.today(r.place.id)}>
                <span className="compare-name">
                  {r.place.name}
                  <span className="compare-sub">{r.f && r.nowLocal ? `${fmt.clock(r.nowLocal)} · ${r.f.current.conditionLabel}` : r.sub}</span>
                </span>
                {r.f ? <WeatherIcon condition={r.f.current.condition} size={24} label={r.f.current.conditionLabel} /> : <span />}
                <span className="compare-bar" aria-hidden>
                  {r.value != null ? <span className={cx('compare-fill', `compare-${key}`)} style={{ width: `${Math.max(4, ((r.value - lo) / Math.max(hi - lo, 1)) * 100)}%` }} /> : null}
                </span>
                <span className="compare-val">
                  {r.text}
                  {r.f ? <span className="compare-sub">{r.sub}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </GlassPanel>
      <p className="detail-hint">Bars share one scale. Each row opens that city.</p>
    </div>
  );
}

function measure(key: CompareKey, f: Forecast, nowLocal: string, fmt: Format): { value: number | null; text: string; sub: string } {
  const c = f.current;
  const today = f.daily[dayIndexOf(f, nowLocal)];
  switch (key) {
    case 'temp': {
      const r = todayRange(f, nowLocal);
      return { value: fmt.tempValue(c.tempC), text: fmt.temp(c.tempC), sub: `H ${fmt.temp(r.maxC)} · L ${fmt.temp(r.minC)}` };
    }
    case 'rain': {
      const amt = today?.precipSumMm != null ? fmt.precip(today.precipSumMm) : null;
      return { value: today?.precipProbability ?? null, text: today?.precipProbability != null ? `${today.precipProbability}%` : '—', sub: amt && amt.value > 0 ? `${amt.text} ${amt.unit} today` : 'Dry today' };
    }
    case 'wind': {
      const w = fmt.wind(c.windKmh);
      return { value: w.value, text: `${w.text} ${w.unit}`, sub: `From ${compassPoint(c.windDirectionDeg)} · gusts ${fmt.wind(c.windGustKmh).text}` };
    }
    case 'air':
      return { value: c.aqi, text: c.aqi != null ? String(Math.round(c.aqi)) : '—', sub: c.aqi != null ? aqiLabel(c.aqi) : 'No data' };
  }
}

function pickBest(key: CompareKey, rows: Row[]): string | null {
  const ready = rows.filter((r) => r.value != null);
  if (ready.length < 2) return null;
  const by = (dir: 1 | -1) => ready.reduce((a, b) => ((b.value! - a.value!) * dir > 0 ? b : a));
  switch (key) {
    case 'temp':
      return `Warmest now: ${by(1).place.name}. Coldest: ${by(-1).place.name}.`;
    case 'rain':
      return `Driest today: ${by(-1).place.name}. Wettest: ${by(1).place.name}.`;
    case 'wind':
      return `Calmest now: ${by(-1).place.name}. Windiest: ${by(1).place.name}.`;
    case 'air':
      return `Cleanest air: ${by(-1).place.name}.`;
  }
}
