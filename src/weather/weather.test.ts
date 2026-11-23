import { describe, expect, it } from 'vitest';
import { formatTemp } from '../design-system';
import { chooseScene, fromWmoCode } from './conditions';
import { DEFAULT_PLACES, matchesPlace } from './places';
import { buildSampleForecast, createMockProvider } from './providers/mock';
import { resolveProviderId } from './providers';
import { localNow, presentForecast } from './present';
import { summarize } from './summary';
import { formatClock, formatDuration, formatLongDate, localNowIn, minutesBetween } from './time';
import { aqiLabel, compassPoint, compassWords, distance, pressure, speed, toUnitTemp, uvLabel } from './units';

describe('formatTemp', () => {
  it('uses a true minus sign and a degree sign', () => {
    expect(formatTemp(18.4)).toBe('18°');
    expect(formatTemp(-2)).toBe('−2°');
    expect(formatTemp(-0.3)).toBe('0°');
    expect(formatTemp('—')).toBe('—');
  });
});

describe('units', () => {
  it('converts temperature, speed, distance and pressure', () => {
    expect(toUnitTemp(100, 'F')).toBe(212);
    expect(speed(19, 'F')).toEqual({ value: 12, unit: 'mph' });
    expect(speed(19, 'C')).toEqual({ value: 19, unit: 'km/h' });
    expect(distance(16.7, 'C')).toEqual({ value: 17, unit: 'km' });
    expect(distance(4.2, 'C')).toEqual({ value: 4.2, unit: 'km' });
    expect(pressure(1018, 'F')).toEqual({ value: '30.06', unit: 'inHg' });
  });
  it('names compass points', () => {
    expect(compassPoint(280)).toBe('W');
    expect(compassPoint(30)).toBe('NNE');
    expect(compassWords(30)).toBe('from the north-north-east');
  });
  it('labels UV and air quality', () => {
    expect(uvLabel(5)).toBe('Moderate');
    expect(uvLabel(9)).toBe('Very high');
    expect(aqiLabel(32)).toBe('Good');
  });
});

describe('time helpers', () => {
  it('formats local times without converting zones', () => {
    expect(formatClock('2026-11-23T14:41')).toBe('2:41 PM');
    expect(formatClock('2026-11-23T00:00', true)).toBe('12 AM');
    expect(formatLongDate('2026-11-23T14:41')).toBe('Monday, November 23');
    expect(minutesBetween('2026-11-23T22:41', '2026-11-24T07:32')).toBe(531);
    expect(formatDuration(134)).toBe('2 h 14 min');
  });
});

describe('conditions and scenes', () => {
  it('maps WMO codes', () => {
    expect(fromWmoCode(0, false)).toEqual({ condition: 'moon', label: 'Clear' });
    expect(fromWmoCode(95)).toEqual({ condition: 'storm', label: 'Thunderstorm' });
    expect(fromWmoCode(1234).label).toBe('Unknown');
  });
  it('chooses a theme and photo from the weather', () => {
    const base = { tempC: 15, uvIndex: 3, isDay: true, time: '2026-11-23T12:00', conditionLabel: 'Clear' } as const;
    const day = { sunrise: '2026-11-23T07:00', sunset: '2026-11-23T17:00' };
    expect(chooseScene({ ...base, condition: 'rain' }, day)).toEqual({ scene: 'rain', photo: 'rain', precip: 'rain' });
    expect(chooseScene({ ...base, condition: 'storm' }, day)).toEqual({ scene: 'rain', photo: 'storm', precip: 'rain' });
    expect(chooseScene({ ...base, condition: 'snow' }, day)).toEqual({ scene: 'aurora', photo: 'snow', precip: 'snow' });
    expect(chooseScene({ ...base, condition: 'snow', isDay: false }, day).photo).toBe('aurora');
    expect(chooseScene({ ...base, condition: 'moon', isDay: false }, day, 37.8)).toEqual({ scene: 'aurora', photo: 'night', precip: null });
    expect(chooseScene({ ...base, condition: 'moon', isDay: false }, day, 64.1).photo).toBe('aurora');
    expect(chooseScene({ ...base, condition: 'cloud', isDay: false }, day).photo).toBe('night-cloudy');
    expect(chooseScene({ ...base, condition: 'cloud', conditionLabel: 'Fog' }, day).photo).toBe('fog');
    expect(chooseScene({ ...base, condition: 'cloud', conditionLabel: 'Overcast' }, day).photo).toBe('overcast');
    expect(chooseScene({ ...base, condition: 'sun', time: '2026-11-23T07:30' }, day)).toMatchObject({ scene: 'dawn', photo: 'dawn' });
    expect(chooseScene({ ...base, condition: 'sun', time: '2026-11-23T16:15' }, day)).toMatchObject({ scene: 'dawn', photo: 'dusk' });
    expect(chooseScene({ ...base, condition: 'partly' }, day).photo).toBe('partly');
    expect(chooseScene({ ...base, condition: 'sun', uvIndex: 9 }, day)).toMatchObject({ scene: 'sun', photo: 'sunny' });
    expect(chooseScene({ ...base, condition: 'sun' }, day)).toMatchObject({ scene: 'clear', photo: 'sunny' });
  });
});

describe('local clock', () => {
  it('reads the current wall-clock time in a time zone', () => {
    const now = new Date('2026-11-23T22:41:00Z');
    expect(localNowIn('America/Los_Angeles', now)).toBe('2026-11-23T14:41');
    expect(localNowIn('Asia/Tokyo', now)).toBe('2026-11-24T07:41');
    expect(localNowIn('Not/AZone', now, 'fallback')).toBe('fallback');
  });
  it('uses the real clock for live data and the fixed time for samples', async () => {
    const f = await createMockProvider({ delayMs: 0 }).getForecast(DEFAULT_PLACES[0]);
    expect(localNow(f, new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-23T14:41');
    const live = { ...f, isSample: false, current: { ...f.current, time: '2026-11-23T14:30' } };
    expect(localNow(live, new Date('2026-11-23T22:55:00Z'))).toBe('2026-11-23T14:55');
  });
});

describe('places', () => {
  it('matches without accents', () => {
    expect(matchesPlace(DEFAULT_PLACES[4], 'reykjavik')).toBe(true);
    expect(matchesPlace(DEFAULT_PLACES[0], 'california')).toBe(true);
  });
});

describe('provider selection', () => {
  it('prefers the URL, then the env, then Open-Meteo', () => {
    expect(resolveProviderId('?provider=mock', 'open-meteo')).toBe('mock');
    expect(resolveProviderId('', 'mock')).toBe('mock');
    expect(resolveProviderId('?provider=nope', undefined)).toBe('open-meteo');
  });
});

describe('presentForecast and summarize (sample data)', () => {
  it('builds the London view: rain scene, alert, night sun note', async () => {
    const f = await createMockProvider({ delayMs: 0 }).getForecast(DEFAULT_PLACES[3]);
    const v = presentForecast(f, 'C');
    expect(v.scene).toBe('rain');
    expect(v.precip).toBe('rain');
    expect(v.alert?.title).toBe('Yellow rain warning');
    expect(v.hours).toHaveLength(9);
    expect(v.hours[0].label).toBe('Now');
    expect(v.hours[1].label).toBe('1 AM');
    expect(v.days[0].day).toBe('Today');
    expect(v.sun?.progress).toBe(1);
    expect(v.sun?.note).toBe('Sunrise in 8 h 51 min');
    expect(v.localTime).toBe('10:41 PM');
    expect(summarize(f, 'C')).toMatch(/^Rain easing around \d+ (AM|PM)\. Low of \d+° overnight\. Gusts up to 58 km\/h\.$/);
  });

  it('converts the whole view to Fahrenheit', async () => {
    const f = await createMockProvider({ delayMs: 0 }).getForecast(DEFAULT_PLACES[0]);
    const v = presentForecast(f, 'F');
    expect(v.hero.temp).toBeCloseTo(64.4);
    expect(v.wind.unit).toBe('mph');
    expect(v.pressure.unit).toBe('inHg');
    expect(summarize(f, 'F')).toBe('Dry for the next 24 hours. High of 66° this afternoon.');
  });

  it('rejects places the sample data does not cover', async () => {
    const place = { ...DEFAULT_PLACES[0], id: 'geo:1', name: 'Oslo' };
    await expect(createMockProvider({ delayMs: 0 }).getForecast(place)).rejects.toMatchObject({ kind: 'not-found' });
    expect(() => buildSampleForecast(place, undefined as never, '')).toThrow();
  });
});
