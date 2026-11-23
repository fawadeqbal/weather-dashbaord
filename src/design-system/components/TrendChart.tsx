import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Condition } from '../icons';
import { clamp, cx, round2 } from '../format';
import { WeatherIcon } from './WeatherIcon';

export interface TrendPoint {
  /** Axis label, e.g. "3 PM". */
  label: string;
  value: number | null;
  /** The value as text for the bubble and labels, e.g. "17°". */
  display: string;
  /** Second line in the bubble, e.g. "Feels like 15°". */
  detail?: string;
  icon?: Condition;
}

export interface TrendChartProps {
  points: TrendPoint[];
  kind?: 'line' | 'bar';
  /** Fixed scale; defaults to the data range (bars start at 0). */
  min?: number;
  max?: number;
  height?: number;
  /** Show every n-th axis label (default: about 8 labels). */
  labelEvery?: number;
  /** Show the value above each point (line) or bar. Default true when 12 points or fewer. */
  showValues?: boolean;
  /** Accessible name, e.g. "Temperature for the next 24 hours". */
  label: string;
  className?: string;
}

/**
 * An interactive trend: hover, drag or use the arrow keys to read any point.
 * The first point is "now" and pulses until another point is selected.
 */
export function TrendChart({ points, kind = 'line', min, max, height = 180, labelEvery, showValues, label, className }: TrendChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const gradientId = `nbTrend${useId().replace(/:/g, '')}`;
  const n = points.length;
  if (!n) return null;

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = min ?? (kind === 'bar' ? 0 : Math.min(...values));
  const hi = max ?? Math.max(...values, lo + 1);
  const range = Math.max(hi - lo, 1e-6);
  const top = kind === 'line' ? 24 : 18;
  const span = kind === 'line' ? 56 : 70;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => top + (1 - (clamp(v, lo, hi) - lo) / range) * span;
  const every = labelEvery ?? Math.max(1, Math.ceil(n / 8));
  const valuesOn = showValues ?? n <= 12;

  let line = '';
  let area = '';
  if (kind === 'line') {
    const pts = points.map((p, i) => (p.value == null ? null : { x: x(i), y: y(p.value) }));
    const segs = pts.filter((p): p is { x: number; y: number } => !!p);
    if (segs.length) {
      line = `M${round2(segs[0].x)} ${round2(segs[0].y)}`;
      for (let i = 0; i < segs.length - 1; i++) {
        const p0 = segs[i - 1] ?? segs[i];
        const p1 = segs[i];
        const p2 = segs[i + 1];
        const p3 = segs[i + 2] ?? p2;
        line += ` C${round2(p1.x + (p2.x - p0.x) / 6)} ${round2(p1.y + (p2.y - p0.y) / 6)} ${round2(p2.x - (p3.x - p1.x) / 6)} ${round2(p2.y - (p3.y - p1.y) / 6)} ${round2(p2.x)} ${round2(p2.y)}`;
      }
      area = `${line} L${round2(segs[segs.length - 1].x)} 100 L${round2(segs[0].x)} 100 Z`;
    }
  }

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setSelected(clamp(Math.floor(((clientX - r.left) / r.width) * n), 0, n - 1));
  };
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = selected ?? 0;
    if (e.key === 'ArrowRight') setSelected(clamp(cur + 1, 0, n - 1));
    else if (e.key === 'ArrowLeft') setSelected(clamp(cur - 1, 0, n - 1));
    else if (e.key === 'Home') setSelected(0);
    else if (e.key === 'End') setSelected(n - 1);
    else if (e.key === 'Escape') setSelected(null);
    else return;
    e.preventDefault();
  };

  const active = selected ?? 0;
  const ap = points[active];
  const bubbleLeft = clamp(x(active), 8, 92);

  return (
    <div className={cx('nb-trend', className)}>
      <div
        ref={box}
        className={cx('nb-trend-plot', kind === 'bar' && 'nb-trend-bars')}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${label}. Use the arrow keys to read each point.`}
        onPointerMove={onPointer}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
          pick(e.clientX);
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSelected(null)}
        onKeyDown={onKey}
        onBlur={() => setSelected(null)}
      >
        <div className="nb-chart-grid" style={{ top: `${top}%` }} aria-hidden />
        <div className="nb-chart-grid" style={{ top: `${top + span / 2}%` }} aria-hidden />
        <div className="nb-chart-grid" style={{ top: `${top + span}%` }} aria-hidden />

        {kind === 'line' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="nb-chart-area-top" />
                <stop offset="1" className="nb-chart-area-end" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} className="nb-chart-line" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <div className="nb-bars" aria-hidden>
            {points.map((p, i) => (
              <span key={i} className={cx('nb-bar', i === selected && 'nb-bar-on')}>
                <span className="nb-bar-fill" style={{ height: `${p.value == null ? 0 : round2(((clamp(p.value, lo, hi) - lo) / range) * 100)}%` }} />
              </span>
            ))}
          </div>
        )}

        {valuesOn
          ? points.map((p, i) =>
              p.value == null ? null : (
                <span key={i} className="nb-trend-val" style={{ left: `${round2(x(i))}%`, top: `${round2(y(p.value))}%` }} aria-hidden>
                  {p.display}
                </span>
              ),
            )
          : null}

        {kind === 'line'
          ? points.map((p, i) =>
              p.value == null ? null : (
                <span
                  key={i}
                  className={cx('nb-trend-dot', i === 0 && selected == null && 'nb-trend-dot-now', i === selected && 'nb-trend-dot-on')}
                  style={{ left: `${round2(x(i))}%`, top: `${round2(y(p.value))}%` }}
                  aria-hidden
                />
              ),
            )
          : null}

        {selected != null ? (
          <>
            <span className="nb-trend-guide" style={{ left: `${round2(x(selected))}%` }} aria-hidden />
            <span className="nb-trend-bubble" style={{ left: `${round2(bubbleLeft)}%` }} aria-hidden>
              <span className="nb-trend-bubble-label">
                {ap.icon ? <WeatherIcon condition={ap.icon} size={14} /> : null}
                {ap.label}
              </span>
              <strong>{ap.display}</strong>
              {ap.detail ? <span className="nb-trend-bubble-detail">{ap.detail}</span> : null}
            </span>
          </>
        ) : null}
      </div>
      <div className="nb-trend-axis" aria-hidden>
        {points.map((p, i) => (
          <span key={i} className="nb-trend-tick" style={{ left: `${round2(x(i))}%` }}>
            {i % every === 0 ? p.label : ''}
          </span>
        ))}
      </div>
      <p className="nb-sr" aria-live="polite">
        {selected != null ? `${ap.label}: ${ap.display}${ap.detail ? `, ${ap.detail}` : ''}` : ''}
      </p>
    </div>
  );
}
