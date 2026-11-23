import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../format';

export type Scene = 'clear' | 'dawn' | 'sun' | 'rain' | 'aurora';

export interface SkyLayer {
  src: string;
  position?: string;
}

export interface SkyBackdropProps {
  /** Scene theme for everything inside. Omit to inherit the page's data-theme. */
  scene?: Scene;
  /** The sky photo. Changing it crossfades from the previous photo. */
  photo?: SkyLayer;
  /** Every photo the app may show, so a change can crossfade. Defaults to [photo]. */
  photos?: SkyLayer[];
  precip?: 'rain' | 'snow' | null;
  /** "strong" darkens the scrim for bright photos (fog, frost, white clouds). */
  scrim?: 'normal' | 'strong';
  minHeight?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** The full-bleed sky behind a screen: photo, scrim and optional falling rain or snow. */
export function SkyBackdrop({ scene, photo, photos, precip, scrim = 'normal', minHeight, className, style, children }: SkyBackdropProps) {
  const layers = photos ?? (photo ? [photo] : []);
  return (
    <div className={cx('nb-sky', scrim === 'strong' && 'nb-sky-strong', className)} data-theme={scene} style={{ minHeight, ...style }}>
      {layers.map((layer) => (
        <img
          key={layer.src}
          className="nb-sky-photo"
          src={layer.src}
          alt=""
          aria-hidden
          style={{ objectPosition: layer.position ?? 'center', opacity: photo?.src === layer.src ? 1 : 0 }}
        />
      ))}
      <div className="nb-sky-scrim" aria-hidden />
      {precip ? <div className={`nb-sky-precip nb-sky-${precip}`} aria-hidden /> : null}
      <div className="nb-sky-content">{children}</div>
    </div>
  );
}

export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  radius?: 'lg' | 'xl' | '2xl';
}

/** The frosted-glass surface every piece of Nimbus data sits on. */
export function GlassPanel({ as: Tag = 'section', padding = 'lg', radius = '2xl', className, children, ...rest }: GlassPanelProps) {
  return (
    <Tag {...rest} className={cx('nb-glass', `nb-pad-${padding}`, `nb-r-${radius}`, className)}>
      {children}
    </Tag>
  );
}
