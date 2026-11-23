import type { SkyLayer } from '../design-system';

/**
 * Real sky photos (public/skies, from Unsplash under the Unsplash licence).
 * None shows a landmark, so any photo can stand behind any city.
 */
export type PhotoKey =
  | 'sunny'
  | 'partly'
  | 'overcast'
  | 'fog'
  | 'dawn'
  | 'dusk'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'night'
  | 'night-cloudy'
  | 'aurora';

export interface SkyPhoto extends SkyLayer {
  /** Bright photos need the stronger scrim so text on glass stays legible. */
  bright?: boolean;
}

export const PHOTOS: Record<PhotoKey, SkyPhoto> = {
  sunny: { src: '/skies/sky-sunny.jpg', position: 'center 30%' },
  partly: { src: '/skies/sky-partly.jpg', position: 'center 40%', bright: true },
  overcast: { src: '/skies/sky-overcast.jpg', position: 'center 35%' },
  fog: { src: '/skies/sky-fog.jpg', position: 'center 30%', bright: true },
  dawn: { src: '/skies/sky-dawn.jpg', position: 'center 45%' },
  dusk: { src: '/skies/sky-dusk.jpg', position: 'center 40%', bright: true },
  rain: { src: '/skies/sky-rain.jpg', position: 'center 45%' },
  storm: { src: '/skies/sky-storm.jpg', position: 'center 40%' },
  snow: { src: '/skies/sky-snow.jpg', position: 'center 45%', bright: true },
  night: { src: '/skies/sky-night.jpg', position: 'center 60%' },
  'night-cloudy': { src: '/skies/sky-night-cloudy.jpg', position: 'center 40%' },
  aurora: { src: '/skies/sky-aurora.jpg', position: 'center 55%' },
};

export const ALL_PHOTOS: SkyLayer[] = Object.values(PHOTOS);
