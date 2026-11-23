import type { ReactNode } from 'react';
import type { IconName } from '../icons';
import { clamp, cx, round2 } from '../format';
import { GlassPanel } from './Surfaces';
import { WeatherIcon } from './WeatherIcon';

export interface MetricTileProps {
  label: string;
  icon?: IconName;
  value?: ReactNode;
  unit?: string;
  /** A word after the value, e.g. "Moderate". */
  qualifier?: string;
  caption?: string;
  /** A graphic shown to the right of the value (WindCompass, PressureGauge). */
  visual?: ReactNode;
  /** Content under the value (RangeMeter, SunArc, notes). */
  children?: ReactNode;
}

/** One weather metric in a glass tile. */
export function MetricTile({ label, icon, value, unit, qualifier, caption, visual, children }: MetricTileProps) {
  const valueEl =
    value !== undefined ? (
      <span className="nb-tile-value">
        {value}
        {unit ? <span className="nb-tile-unit">{unit}</span> : null}
        {qualifier ? <span className="nb-tile-qual">{qualifier}</span> : null}
      </span>
    ) : null;
  return (
    <GlassPanel as="article" padding="md" radius="xl" className="nb-tile">
      <h3 className="nb-label">
        {icon ? <WeatherIcon condition={icon} size={16} strokeWidth={1.8} tinted={false} /> : null}
        {label}
      </h3>
      {visual ? (
        <div className="nb-tile-body">
          <div className="nb-tile-text">
            {valueEl}
            {children}
          </div>
          {visual}
        </div>
      ) : (
        <>
          {valueEl}
          {children}
        </>
      )}
      {caption ? <span className="nb-tile-caption">{caption}</span> : null}
    </GlassPanel>
  );
}

/** A compass whose needle points the way the wind is blowing. `degrees` is where it comes FROM. */
export function WindCompass({ degrees, size = 108, label }: { degrees: number; size?: number; label?: string }) {
  const towards = (((degrees + 180) % 360) + 360) % 360;
  return (
    <div className="nb-compass" style={{ width: size, height: size }} role="img" aria-label={label ?? `Wind direction ${Math.round(degrees)} degrees`}>
      <span className="nb-compass-pt nb-compass-n" aria-hidden>N</span>
      <span className="nb-compass-pt nb-compass-s" aria-hidden>S</span>
      <span className="nb-compass-pt nb-compass-w" aria-hidden>W</span>
      <span className="nb-compass-pt nb-compass-e" aria-hidden>E</span>
      <div className="nb-compass-needle" style={{ transform: `translate(-50%, -50%) rotate(${towards}deg)` }} aria-hidden>
        <span className="nb-compass-head" />
        <span className="nb-compass-front" />
        <span className="nb-compass-tail" />
      </div>
      <span className="nb-compass-hub" aria-hidden />
    </div>
  );
}

export interface RangeMeterProps {
  value: number;
  min?: number;
  /** Defaults: uv 11, aqi 150, fill 100. */
  max?: number;
  scale?: 'uv' | 'aqi' | 'fill';
  label: string;
}

/** A meter that places a reading on its scale: a marker on the level scale, or a fill. */
export function RangeMeter({ value, min = 0, max, scale = 'fill', label }: RangeMeterProps) {
  const top = max ?? (scale === 'uv' ? 11 : scale === 'aqi' ? 150 : 100);
  const pct = `${round2(clamp((value - min) / (top - min), 0, 1) * 100)}%`;
  return (
    <div className={cx('nb-meter', `nb-meter-${scale}`)} role="meter" aria-valuemin={min} aria-valuemax={top} aria-valuenow={value} aria-label={label}>
      {scale === 'fill' ? <span className="nb-meter-fill" style={{ width: pct }} /> : <span className="nb-meter-marker" style={{ left: pct }} />}
    </div>
  );
}

/** The sun's path from sunrise to sunset. `progress` is 0 at sunrise and 1 at sunset. */
export function SunArc({ progress, sunrise, sunset }: { progress: number; sunrise: string; sunset: string }) {
  const p = clamp(progress, 0, 1);
  const sx = round2(100 - 80 * Math.cos(Math.PI * p));
  const sy = round2(100 - 80 * Math.sin(Math.PI * p));
  return (
    <div className="nb-sun">
      <svg viewBox="0 0 200 108" aria-hidden>
        <line x1="6" y1="100" x2="194" y2="100" className="nb-sun-base" />
        <path d="M20 100 A80 80 0 0 1 180 100" className="nb-sun-path" />
        {p > 0 ? <path d={`M20 100 A80 80 0 0 1 ${sx} ${sy}`} className="nb-sun-done" /> : null}
        <circle cx={sx} cy={sy} r="12" className="nb-sun-halo" />
        <circle cx={sx} cy={sy} r="6.5" className="nb-sun-dot" />
      </svg>
      <div className="nb-sun-times">
        <span>Rise <strong>{sunrise}</strong></span>
        <span>Set <strong>{sunset}</strong></span>
      </div>
    </div>
  );
}

/** A half-dial showing air pressure against the usual range (983–1043 hPa). */
export function PressureGauge({ hpa, min = 983, max = 1043, size = 120, label }: { hpa: number; min?: number; max?: number; size?: number; label?: string }) {
  const deg = round2(clamp((hpa - min) / (max - min), 0, 1) * 180 - 90);
  return (
    <svg viewBox="0 0 120 70" width={size} height={Math.round((size * 70) / 120)} role="img" aria-label={label ?? `Pressure ${Math.round(hpa)} hectopascals`} style={{ flex: 'none' }}>
      <path d="M10 62 A50 50 0 0 1 110 62" className="nb-gauge-track" />
      <path d="M10 62 A50 50 0 0 1 110 62" className="nb-gauge-ticks" />
      <g transform={`rotate(${deg} 60 62)`}>
        <line x1="60" y1="62" x2="60" y2="22" className="nb-gauge-needle" />
      </g>
      <circle cx="60" cy="62" r="5" className="nb-gauge-hub" />
    </svg>
  );
}
