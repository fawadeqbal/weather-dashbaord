import { describe, expect, it } from 'vitest';
import { formatTemp } from '../design-system';
import { chooseScene, fromWmoCode } from './conditions';
import { defaultPrefs, IMPERIAL, isUnitPrefs, makeFormat, METRIC, withTemp } from './format';
import { DEFAULT_PLACES, matchesPlace } from './places';
import { resolveProviderId } from './providers';
import { buildSampleForecast, createMockProvider, SAMPLES } from './providers/mock';
import { dayLabel, hoursOn, localNow, nextHours, nowIndex, sceneFor, sunInfo } from './selectors';
import { summarize, summarizeDay } from './summary';
import { formatDuration, formatLongDate, formatShortDate, localNowIn, minutesBetween } from './time';
import { aqiLabel, compassPoint, compassWords, uvLabel, windForce } from './units';

const mock = createMockProvider({ delayMs: 0 });

describe('formatTemp', () => {
  it('uses a true minus sign and a degree sign', () => {
    expect(formatTemp(18.4)).toBe('18°');
    expect(formatTemp(-2)).toBe('−2°');
    expect(formatTemp(-0.3)).toBe('0°');
    expect(formatTemp('—')).toBe('—');
  });
});

describe('unit preferences and formatting', () => {
  const metric = makeFormat(METRIC);
  const imperial = makeFormat(IMPERIAL);
  it('formats each unit', () => {
    expect(imperial.temp(100)).toBe('212°');
    expect(imperial.windText(19)).toBe('12 mph');
    expect(makeFormat({ ...METRIC, wind: 'ms' }).windText(36)).toBe('10 m/s');
    expect(makeFormat({ ...METRIC, wind: 'kn' }).windText(37)).toBe('20 kn');
    expect(metric.distance(16.7)).toMatchObject({ text: '17', unit: 'km' });
    expect(metric.distance(4.2)).toMatchObject({ text: '4.2', unit: 'km' });
    expect(imperial.pressure(1018)).toMatchObject({ text: '30.06', unit: 'inHg' });
    expect(makeFormat({ ...METRIC, pressure: 'mmHg' }).pressure(1013)).toMatchObject({ text: '760', unit: 'mmHg' });
    expect(imperial.precip(25.4)).toMatchObject({ text: '1.00', unit: 'in' });
  });
  it('formats the clock in 12 or 24 hours', () => {
    expect(imperial.clock('2026-11-23T14:41')).toBe('2:41 PM');
    expect(imperial.clock('2026-11-23T00:00', true)).toBe('12 AM');
    expect(metric.clock('2026-11-23T09:05')).toBe('09:05');
  });
  it('switches related units with the quick °C/°F toggle but keeps the clock', () => {
    expect(withTemp({ ...METRIC, clock: '12h' }, 'F')).toEqual({ ...IMPERIAL, clock: '12h' });
  });
  it('picks locale defaults and validates stored prefs', () => {
    expect(defaultPrefs('en-US')).toEqual(IMPERIAL);
    expect(defaultPrefs('de-DE')).toEqual(METRIC);
    expect(defaultPrefs('en-GB').clock).toBe('24h');
    expect(isUnitPrefs(METRIC)).toBe(true);
    expect(isUnitPrefs({ temp: 'K' })).toBe(false);
  });
});

describe('words for values', () => {
  it('names compass points, UV, air quality and wind force', () => {
    expect(compassPoint(280)).toBe('W');
    expect(compassWords(30)).toBe('from the north-north-east');
    expect(uvLabel(5)).toBe('Moderate');
    expect(aqiLabel(32)).toBe('Good');
    expect(windForce(19)).toEqual({ force: 3, label: 'Gentle breeze' });
    expect(windForce(0)).toEqual({ force: 0, label: 'Calm' });
  });
});

describe('time helpers', () => {
  it('handles local wall-clock strings', () => {
    expect(formatLongDate('2026-11-23T14:41')).toBe('Monday, November 23');
    expect(formatShortDate('2026-11-24')).toBe('Nov 24');
    expect(minutesBetween('2026-11-23T22:41', '2026-11-24T07:32')).toBe(531);
    expect(formatDuration(134)).toBe('2 h 14 min');
  });
  it('reads the current wall-clock time in a time zone', () => {
    const now = new Date('2026-11-23T22:41:00Z');
    expect(localNowIn('America/Los_Angeles', now)).toBe('2026-11-23T14:41');
    expect(localNowIn('Asia/Tokyo', now)).toBe('2026-11-24T07:41');
    expect(localNowIn('Not/AZone', now, 'fallback')).toBe('fallback');
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
    expect(chooseScene({ ...base, condition: 'moon', isDay: false }, day, 37.8).photo).toBe('night');
    expect(chooseScene({ ...base, condition: 'moon', isDay: false }, day, 64.1).photo).toBe('aurora');
    expect(chooseScene({ ...base, condition: 'cloud', conditionLabel: 'Fog' }, day).photo).toBe('fog');
    expect(chooseScene({ ...base, condition: 'sun', time: '2026-11-23T07:30' }, day)).toMatchObject({ scene: 'dawn', photo: 'dawn' });
    expect(chooseScene({ ...base, condition: 'sun', time: '2026-11-23T16:15' }, day)).toMatchObject({ scene: 'dawn', photo: 'dusk' });
    expect(chooseScene({ ...base, condition: 'sun', uvIndex: 9 }, day)).toMatchObject({ scene: 'sun', photo: 'sunny' });
  });
});

describe('places and provider selection', () => {
  it('matches without accents', () => {
    expect(matchesPlace(DEFAULT_PLACES[4], 'reykjavik')).toBe(true);
    expect(matchesPlace(DEFAULT_PLACES[0], 'california')).toBe(true);
  });
  it('prefers the URL, then the env, then Open-Meteo', () => {
    expect(resolveProviderId('?provider=mock', 'open-meteo')).toBe('mock');
    expect(resolveProviderId('', 'mock')).toBe('mock');
    expect(resolveProviderId('?provider=nope', undefined)).toBe('open-meteo');
  });
});

describe('sample data and selectors', () => {
  it('generates seven full days of hourly data', async () => {
    const f = await mock.getForecast(DEFAULT_PLACES[0]);
    expect(f.hourly).toHaveLength(7 * 24);
    expect(f.hourly[0].time).toBe('2026-11-23T00:00');
    expect(hoursOn(f, '2026-11-25')).toHaveLength(24);
    expect(f.hourly.every((h) => h.windKmh != null && h.humidity != null)).toBe(true);
  });

  it('uses the real clock for live data and the fixed time for samples', async () => {
    const f = await mock.getForecast(DEFAULT_PLACES[0]);
    expect(localNow(f, new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-23T14:41');
    const live = { ...f, isSample: false, current: { ...f.current, time: '2026-11-23T14:30' } };
    expect(localNow(live, new Date('2026-11-23T22:55:00Z'))).toBe('2026-11-23T14:55');
  });

  it('picks the next hours from now and labels days', async () => {
    const f = await mock.getForecast(DEFAULT_PLACES[0]);
    const now = localNow(f);
    expect(nowIndex(f, now)).toBe(14);
    expect(nextHours(f, now, 25)[0].time).toBe('2026-11-23T14:00');
    expect(dayLabel(f, 0, now)).toBe('Today');
    expect(dayLabel(f, 1, now)).toBe('Tomorrow');
    expect(dayLabel(f, 2, now, true)).toBe('Wednesday');
  });

  it('builds the London view: rain scene, sun note, summary', async () => {
    const f = await mock.getForecast(DEFAULT_PLACES[3]);
    const now = localNow(f);
    const fmt = makeFormat(METRIC);
    expect(sceneFor(f, now)).toMatchObject({ scene: 'rain', photo: 'rain', precip: 'rain' });
    expect(sunInfo(f, now, makeFormat(IMPERIAL))).toMatchObject({ progress: 1, note: 'Sunrise in 8 h 51 min', sunrise: '7:32 AM' });
    expect(summarize(f, fmt, now)).toMatch(/Low of \d+° overnight\. Gusts up to 58 km\/h\.$/);
    expect(summarizeDay(hoursOn(f, '2026-11-23'), fmt)).toMatch(/^Rain likely from/);
  });

  it('summarises in the viewer’s units', async () => {
    const f = await mock.getForecast(DEFAULT_PLACES[0]);
    expect(summarize(f, makeFormat(IMPERIAL), localNow(f))).toMatch(/High of 66° this afternoon\.$/);
  });

  it('rejects places the sample data does not cover', async () => {
    const place = { ...DEFAULT_PLACES[0], id: 'geo:1', name: 'Oslo' };
    await expect(mock.getForecast(place)).rejects.toMatchObject({ kind: 'not-found' });
    expect(Object.keys(SAMPLES)).toHaveLength(5);
    expect(() => buildSampleForecast(place, undefined as never, '')).toThrow();
  });
});
