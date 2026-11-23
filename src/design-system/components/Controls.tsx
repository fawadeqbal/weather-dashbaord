import { useId, useState, type ButtonHTMLAttributes, type ChangeEvent, type ReactNode } from 'react';
import type { Condition, IconName } from '../icons';
import { cx, formatTemp } from '../format';
import type { Scene } from './Surfaces';
import { WeatherIcon } from './WeatherIcon';

export interface CityCardProps {
  name: string;
  localTime?: string;
  condition: Condition;
  conditionLabel: string;
  temp: number | string;
  high?: number | string;
  low?: number | string;
  photo?: string;
  photoPosition?: string;
  /** Scene for the gradient fallback when there is no photo. */
  scene?: Scene;
  selected?: boolean;
  onSelect?: () => void;
  /** Render as a link instead of a toggle button. */
  href?: string;
  className?: string;
}

/** A saved city as a button over its own sky photo. */
export function CityCard({ name, localTime, condition, conditionLabel, temp, high, low, photo, photoPosition, scene, selected, onSelect, href, className }: CityCardProps) {
  const hilo: string[] = [];
  if (high !== undefined) hilo.push(`H ${formatTemp(high)}`);
  if (low !== undefined) hilo.push(`L ${formatTemp(low)}`);
  const body = (
    <>
      {photo ? <img className="nb-card-photo" src={photo} alt="" aria-hidden style={{ objectPosition: photoPosition ?? 'center' }} /> : null}
      <span className="nb-card-scrim" aria-hidden />
      <span className="nb-card-main">
        <span className="nb-card-name">{name}</span>
        {localTime ? <span className="nb-card-time">{localTime}</span> : null}
        <span className="nb-card-cond">
          <WeatherIcon condition={condition} size={16} strokeWidth={1.8} />
          {conditionLabel}
        </span>
      </span>
      <span className="nb-card-side">
        <span className="nb-card-temp">{formatTemp(temp)}</span>
        {hilo.length ? <span className="nb-card-hilo">{hilo.join('  ')}</span> : null}
      </span>
    </>
  );
  if (href) {
    return (
      <a className={cx('nb-card', selected && 'nb-card-selected', className)} href={href} data-theme={scene} aria-current={selected ? 'page' : undefined}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={cx('nb-card', className)} aria-pressed={!!selected} onClick={onSelect} data-theme={scene}>
      {body}
    </button>
  );
}

export interface SearchFieldProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

/** The city search box: a 44px field on glass with a visually hidden label. */
export function SearchField({ id, label = 'Search cities', placeholder = 'Search cities', value, defaultValue, onChange, className }: SearchFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx('nb-search', className)}>
      <label htmlFor={inputId} className="nb-sr">{label}</label>
      <WeatherIcon condition="search" size={18} strokeWidth={1.8} tinted={false} />
      <input id={inputId} type="search" placeholder={placeholder} value={value} defaultValue={defaultValue} onChange={onChange} autoComplete="off" />
    </div>
  );
}

export type Unit = 'C' | 'F';

export interface UnitToggleProps {
  value?: Unit;
  defaultValue?: Unit;
  onChange?: (unit: Unit) => void;
  label?: string;
  className?: string;
}

/** The °C / °F switch. */
export function UnitToggle({ value, defaultValue = 'C', onChange, label = 'Temperature unit', className }: UnitToggleProps) {
  const [own, setOwn] = useState<Unit>(defaultValue);
  const current = value ?? own;
  const pick = (u: Unit) => () => {
    if (value === undefined) setOwn(u);
    onChange?.(u);
  };
  return (
    <div className={cx('nb-toggle', className)} role="group" aria-label={label}>
      <button type="button" aria-pressed={current === 'C'} onClick={pick('C')}>°C</button>
      <button type="button" aria-pressed={current === 'F'} onClick={pick('F')}>°F</button>
    </div>
  );
}

/** A glass banner with an accent border for weather warnings. */
export function AlertBanner({ title, icon = 'alert', children, className }: { title?: string; icon?: IconName; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('nb-alert', className)} role="status">
      <WeatherIcon condition={icon} size={22} strokeWidth={1.8} tinted={false} />
      <p>
        {title ? <strong>{title}</strong> : null}
        {title && children ? ' · ' : null}
        {children}
      </p>
    </div>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  spinning?: boolean;
}

/** A 44px round icon-only button on glass. */
export function IconButton({ icon, label, spinning, className, ...rest }: IconButtonProps) {
  return (
    <button type="button" {...rest} className={cx('nb-icon-btn', className)} aria-label={label} title={label}>
      <WeatherIcon condition={icon} size={20} strokeWidth={1.8} tinted={false} className={spinning ? 'nb-spin' : undefined} />
    </button>
  );
}
