import type { ReactNode } from 'react';
import type { IconName } from '../icons';
import { cx } from '../format';
import { WeatherIcon } from './WeatherIcon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
}

/**
 * The app's main navigation. A bottom tab bar on phones, a pill of links in the
 * header on wider screens (the CSS decides; the markup is the same).
 */
export function TabBar({ items, label = 'Main', className }: { items: NavItem[]; label?: string; className?: string }) {
  return (
    <nav className={cx('nb-tabs', className)} aria-label={label}>
      {items.map((it) => (
        <a key={it.href} href={it.href} className="nb-tab" aria-current={it.active ? 'page' : undefined}>
          <WeatherIcon condition={it.icon} size={20} strokeWidth={1.8} tinted={false} />
          <span>{it.label}</span>
        </a>
      ))}
    </nav>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** A row of mutually exclusive choices with a sliding selection pill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className={cx('nb-seg', size === 'sm' && 'nb-seg-sm', className)}
      role="radiogroup"
      aria-label={label}
      style={{ ['--nb-seg-count' as string]: options.length, ['--nb-seg-index' as string]: index }}
    >
      <span className="nb-seg-pill" aria-hidden />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
            if (!dir) return;
            e.preventDefault();
            const next = options[(index + dir + options.length) % options.length];
            onChange(next.value);
            const group = e.currentTarget.parentElement;
            requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A section heading with an optional "See all" style link. */
export function SectionHeader({ title, action, id }: { title: string; action?: { href: string; label: string }; id?: string }) {
  return (
    <div className="nb-section-head">
      <h2 className="nb-label" id={id}>{title}</h2>
      {action ? (
        <a className="nb-section-link" href={action.href}>
          {action.label}
          <WeatherIcon condition="chevron-right" size={14} strokeWidth={2} tinted={false} />
        </a>
      ) : null}
    </div>
  );
}

/** Back link for detail pages. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="nb-back" href={href}>
      <WeatherIcon condition="chevron-left" size={18} strokeWidth={2} tinted={false} />
      {children}
    </a>
  );
}
