import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Condition, IconName } from '../icons';
import { cx } from '../format';
import { WeatherIcon } from './WeatherIcon';

export interface StatTileProps {
  href: string;
  label: string;
  icon: IconName;
  value: ReactNode;
  unit?: string;
  /** One short line under the value, e.g. "Moderate". */
  caption?: string;
  /** A small visual (meter, compass) at the bottom of the tile. */
  children?: ReactNode;
}

/** A tappable summary of one metric that opens its detail page. */
export function StatTile({ href, label, icon, value, unit, caption, children }: StatTileProps) {
  return (
    <a className="nb-stat nb-glass" href={href}>
      <span className="nb-stat-head">
        <span className="nb-label">
          <WeatherIcon condition={icon} size={15} strokeWidth={1.8} tinted={false} />
          {label}
        </span>
        <WeatherIcon condition="chevron-right" size={16} strokeWidth={2} tinted={false} className="nb-stat-chev" />
      </span>
      <span className="nb-stat-value">
        {value}
        {unit ? <span className="nb-stat-unit">{unit}</span> : null}
      </span>
      {caption ? <span className="nb-stat-caption">{caption}</span> : null}
      {children ? <span className="nb-stat-visual">{children}</span> : null}
    </a>
  );
}

export interface HourCell {
  key: string;
  label: string;
  condition: Condition;
  conditionLabel?: string;
  temp: string;
  pop?: number | null;
  now?: boolean;
}

/** A swipeable row of hours with scroll buttons on wide screens. */
export function HourStrip({ hours, label = 'Hourly forecast' }: { hours: HourCell[]; label?: string }) {
  const scroller = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  };
  useEffect(update, [hours.length]);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className={cx('nb-strip', !edges.start && 'nb-strip-fade-start', !edges.end && 'nb-strip-fade-end')}>
      <button type="button" className="nb-strip-btn nb-strip-prev" onClick={() => page(-1)} disabled={edges.start} aria-label="Earlier hours">
        <WeatherIcon condition="chevron-left" size={18} strokeWidth={2} tinted={false} />
      </button>
      <ol className="nb-strip-list" ref={scroller} onScroll={update} aria-label={label}>
        {hours.map((h) => (
          <li key={h.key} className={cx('nb-strip-cell', h.now && 'nb-strip-now')}>
            <span className="nb-strip-time">{h.label}</span>
            <WeatherIcon condition={h.condition} size={24} label={h.conditionLabel} />
            <span className="nb-strip-temp">{h.temp}</span>
            <span className="nb-pop">{h.pop ? `${h.pop}%` : ' '}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="nb-strip-btn nb-strip-next" onClick={() => page(1)} disabled={edges.end} aria-label="Later hours">
        <WeatherIcon condition="chevron-right" size={18} strokeWidth={2} tinted={false} />
      </button>
    </div>
  );
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts to its new value (e.g. the hero temperature when you change city). */
export function AnimatedNumber({ value, format, duration = 450 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return <>{format(shown)}</>;
}
