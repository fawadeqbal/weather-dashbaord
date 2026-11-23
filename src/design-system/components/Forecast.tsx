import { useId } from 'react';
import type { Condition } from '../icons';
import { cx, formatTemp, round2 } from '../format';
import { GlassPanel } from './Surfaces';
import { WeatherIcon } from './WeatherIcon';
import { SectionHeader } from './Navigation';

export interface Stat {
  label: string;
  value: string;
}

export interface CurrentConditionsProps {
  temp: number | string;
  condition: Condition;
  conditionLabel: string;
  high?: number | string;
  low?: number | string;
  feelsLike?: number | string;
  summary?: string;
  /** Up to three quick stats. */
  stats?: Stat[];
  /** Phone layout: 112px temperature, no side column. */
  compact?: boolean;
}

/** The hero: current temperature, condition, highs and lows, a forecast sentence and quick stats. */
export function CurrentConditions({ temp, condition, conditionLabel, high, low, feelsLike, summary, stats = [], compact }: CurrentConditionsProps) {
  const hilo: string[] = [];
  if (high !== undefined) hilo.push(`H ${formatTemp(high)}`);
  if (low !== undefined) hilo.push(`L ${formatTemp(low)}`);
  if (feelsLike !== undefined) hilo.push(`Feels like ${formatTemp(feelsLike)}`);
  return (
    <GlassPanel padding="xl" aria-label="Current conditions" className={cx('nb-now', compact && 'nb-now-compact')}>
      <div className="nb-now-main">
        <span className="nb-now-temp">{formatTemp(temp)}</span>
        <p className="nb-now-cond">
          <WeatherIcon condition={condition} size={26} />
          {conditionLabel}
        </p>
        {hilo.length ? <p className="nb-now-hilo">{hilo.join(' · ')}</p> : null}
        {summary ? <p className="nb-now-summary">{summary}</p> : null}
      </div>
      {compact ? null : (
        <div className="nb-now-side">
          <div className="nb-now-art">
            <WeatherIcon condition={condition} size={132} strokeWidth={0.9} />
          </div>
          {stats.length ? (
            <ul className="nb-chips">
              {stats.slice(0, 3).map((s) => (
                <li key={s.label} className="nb-chip">
                  <span className="nb-chip-label">{s.label}</span>
                  <span className="nb-chip-value">{s.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </GlassPanel>
  );
}

export interface HourPoint {
  label: string;
  temp: number;
  condition: Condition;
  conditionLabel?: string;
  /** Chance of precipitation, percent. */
  pop?: number | null;
}

export interface HourlyChartProps {
  /** The first entry is "now". */
  hours: HourPoint[];
  title?: string;
  unitLabel?: string;
}

/** The next hours as a smooth temperature curve with time, condition and precipitation chance under each point. */
export function HourlyChart({ hours, title = 'Next 24 hours', unitLabel }: HourlyChartProps) {
  const gradientId = `nbArea${useId().replace(/:/g, '')}`;
  const n = hours.length;
  if (!n) return null;
  const temps = hours.map((h) => h.temp);
  const mn = Math.min(...temps);
  const mx = Math.max(...temps);
  const range = Math.max(mx - mn, 1);
  const pts = temps.map((v, i) => ({ x: ((i + 0.5) / n) * 100, y: 30 + ((mx - v) / range) * 50 }));
  let line = `M${round2(pts[0].x)} ${round2(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    line += ` C${round2(p1.x + (p2.x - p0.x) / 6)} ${round2(p1.y + (p2.y - p0.y) / 6)} ${round2(p2.x - (p3.x - p1.x) / 6)} ${round2(p2.y - (p3.y - p1.y) / 6)} ${round2(p2.x)} ${round2(p2.y)}`;
  }
  const area = `${line} L${round2(pts[n - 1].x)} 100 L${round2(pts[0].x)} 100 Z`;

  return (
    <GlassPanel className="nb-hourly" aria-label={title}>
      <div className="nb-head">
        <h2 className="nb-label">{title}</h2>
        {unitLabel ? <span className="nb-caption">Temperature, {unitLabel}</span> : null}
      </div>
      <div className="nb-hourly-scroll">
        <div className="nb-hourly-inner">
          <div className="nb-chart" aria-hidden>
            <div className="nb-chart-grid" style={{ top: '30%' }} />
            <div className="nb-chart-grid" style={{ top: '55%' }} />
            <div className="nb-chart-grid" style={{ top: '80%' }} />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="nb-chart-area-top" />
                  <stop offset="1" className="nb-chart-area-end" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradientId})`} />
              <path d={line} className="nb-chart-line" vectorEffect="non-scaling-stroke" />
            </svg>
            {pts.map((p, i) => (
              <div
                key={hours[i].label}
                className={cx('nb-chart-pt', i === 0 && 'nb-chart-pt-now')}
                style={{ left: `${round2(p.x)}%`, top: `${round2(p.y)}%` }}
              >
                <span className="nb-chart-val">{formatTemp(hours[i].temp)}</span>
                <span className={cx('nb-chart-dot', i === 0 && 'nb-chart-dot-now')} />
              </div>
            ))}
          </div>
          <ol className="nb-hours" style={{ listStyle: 'none', padding: 0, marginBottom: 0 }}>
            {hours.map((h, i) => (
              <li key={h.label} className={cx('nb-hour', i === 0 && 'nb-hour-now')}>
                <span className="nb-hour-time">{h.label}</span>
                <WeatherIcon condition={h.condition} label={h.conditionLabel} />
                <span className="nb-pop">{h.pop ? `${h.pop}%` : ' '}</span>
                <span className="nb-sr">{formatTemp(h.temp)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GlassPanel>
  );
}

export interface DayForecast {
  day: string;
  condition: Condition;
  conditionLabel?: string;
  pop?: number | null;
  low: number;
  high: number;
  /** Makes the row a link, e.g. to the day's detail page. */
  href?: string;
  /** Shown under the day name, e.g. "Nov 24". */
  sub?: string;
}

/** One row per day with condition, precipitation chance, low, high and a range bar on the week's scale. */
export function DailyForecast({
  days,
  title = '7-day forecast',
  action,
  scale,
  note,
}: {
  days: DayForecast[];
  title?: string;
  action?: { href: string; label: string };
  /** Shared low/high for the range bars, so several lists compare by eye. */
  scale?: { low: number; high: number };
  /** Short line under the title, e.g. a confidence note. */
  note?: string;
}) {
  if (!days.length) return null;
  const lo = scale?.low ?? Math.min(...days.map((d) => d.low));
  const hi = scale?.high ?? Math.max(...days.map((d) => d.high));
  const range = Math.max(hi - lo, 1);
  return (
    <GlassPanel className="nb-daily" aria-label={title}>
      <SectionHeader title={title} action={action} />
      {note ? <p className="nb-daily-note">{note}</p> : null}
      <ul className="nb-days">
        {days.map((d, i) => {
          const cells = (
            <>
            <span className="nb-day-name">{d.day}{d.sub ? <span className="nb-day-sub">{d.sub}</span> : null}</span>
            <WeatherIcon condition={d.condition} label={d.conditionLabel} />
            <span className="nb-pop">{d.pop ? `${d.pop}%` : ' '}</span>
            <span className="nb-day-lo">{formatTemp(d.low)}</span>
            <span className="nb-range" aria-hidden>
              <span
                className="nb-range-fill"
                style={{ left: `${round2(((d.low - lo) / range) * 100)}%`, width: `${round2(Math.max(((d.high - d.low) / range) * 100, 6))}%` }}
              />
            </span>
            <span className="nb-day-hi">{formatTemp(d.high)}</span>
            </>
          );
          return (
            <li key={`${i}-${d.day}`} className="nb-day-item">
              {d.href ? <a className="nb-day nb-day-link" href={d.href}>{cells}<WeatherIcon condition="chevron-right" size={16} strokeWidth={2} tinted={false} className="nb-day-chev" /></a> : <div className="nb-day">{cells}</div>}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
