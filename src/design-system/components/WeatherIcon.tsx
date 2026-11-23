import { ICON_PATHS, TINTED_ICONS, type IconName } from '../icons';
import { cx } from '../format';

export interface WeatherIconProps {
  /** A weather condition (tinted) or an interface icon (currentColor). */
  condition: IconName;
  /** Pixel size. Default 22. */
  size?: number;
  strokeWidth?: number;
  /** Use the condition's --icon-* tint. Default true; interface icons are never tinted. */
  tinted?: boolean;
  /** Accessible name. Omit when a visible word already names the condition. */
  label?: string;
  className?: string;
}

export function WeatherIcon({ condition, size = 22, strokeWidth = 1.7, tinted = true, label, className }: WeatherIconProps) {
  const name: IconName = condition in ICON_PATHS ? condition : 'cloud';
  const tint = tinted && TINTED_ICONS.has(name);
  return (
    <svg
      className={cx('nb-icon', className)}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={tint ? { color: `var(--icon-${name})` } : undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {label ? <title>{label}</title> : null}
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
