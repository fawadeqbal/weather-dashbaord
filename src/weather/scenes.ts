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

/** Photos live in public/skies; BASE_URL makes them work when the app is served from a sub-path. */
const sky = (file: string) => `${import.meta.env.BASE_URL}skies/${file}`;

export const PHOTOS: Record<PhotoKey, SkyPhoto> = {
  sunny: { src: sky('sky-sunny.jpg'), position: 'center 30%' },
  partly: { src: sky('sky-partly.jpg'), position: 'center 40%', bright: true },
  overcast: { src: sky('sky-overcast.jpg'), position: 'center 35%' },
  fog: { src: sky('sky-fog.jpg'), position: 'center 30%', bright: true },
  dawn: { src: sky('sky-dawn.jpg'), position: 'center 45%' },
  dusk: { src: sky('sky-dusk.jpg'), position: 'center 40%', bright: true },
  rain: { src: sky('sky-rain.jpg'), position: 'center 45%' },
  storm: { src: sky('sky-storm.jpg'), position: 'center 40%' },
  snow: { src: sky('sky-snow.jpg'), position: 'center 45%', bright: true },
  night: { src: sky('sky-night.jpg'), position: 'center 60%' },
  'night-cloudy': { src: sky('sky-night-cloudy.jpg'), position: 'center 40%' },
  aurora: { src: sky('sky-aurora.jpg'), position: 'center 55%' },
};

export const ALL_PHOTOS: SkyLayer[] = Object.values(PHOTOS);
