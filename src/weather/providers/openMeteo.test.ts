import { afterEach, describe, expect, it, vi } from 'vitest';
import airSF from './__fixtures__/air-quality-san-francisco.json';
import fcReykjavik from './__fixtures__/forecast-reykjavik.json';
import fcSF from './__fixtures__/forecast-san-francisco.json';
import geoReykjavik from './__fixtures__/geocoding-reykjavik.json';
import { airQualityUrl, createOpenMeteoProvider, forecastUrl, mapGeocoding, mapOpenMeteo, type OpenMeteoAirQuality, type OpenMeteoForecast } from './openMeteo';
import { DEFAULT_PLACES } from '../places';
import { nextHours } from '../selectors';

const SF = DEFAULT_PLACES[0];
const REYKJAVIK = DEFAULT_PLACES[4];

describe('mapOpenMeteo (real responses)', () => {
  const f = mapOpenMeteo(SF, fcSF as OpenMeteoForecast, airSF as OpenMeteoAirQuality, '2026-11-23T14:00:00Z');

  it('maps current conditions in metric units', () => {
    expect(f.timezone).toBe('America/Los_Angeles');
    expect(f.current.time).toBe(fcSF.current.time);
    expect(f.current.tempC).toBe(fcSF.current.temperature_2m);
    expect(f.current.visibilityKm).toBeCloseTo(fcSF.current.visibility / 1000);
    expect(f.current.isDay).toBe(fcSF.current.is_day === 1);
    expect(f.current.aqi).toBe(airSF.current.us_aqi);
    expect(['rising', 'steady', 'falling']).toContain(f.current.pressureTrend);
  });

  it('keeps seven full days of hourly data with every metric', () => {
    expect(f.hourly).toHaveLength(168);
    expect(f.hourly[0].time).toBe(`${f.daily[0].date}T00:00`);
    const h = f.hourly[12];
    for (const key of ['feelsLikeC', 'humidity', 'windKmh', 'windGustKmh', 'windDirectionDeg', 'pressureHpa', 'uvIndex', 'visibilityKm'] as const) {
      expect(typeof h[key]).toBe('number');
    }
  });

  it('joins hourly air quality by time', () => {
    const firstAirTime = airSF.hourly.time[0];
    const hour = f.hourly.find((x) => x.time === firstAirTime);
    expect(hour?.aqi).toBe(airSF.hourly.us_aqi[0]);
    expect(f.hourly[f.hourly.length - 1].aqi).toBeNull(); // air quality covers 5 of the 7 days
  });

  it('finds the next hours from the current time', () => {
    const next = nextHours(f, fcSF.current.time, 25);
    expect(next[0].time.slice(0, 13)).toBe(fcSF.current.time.slice(0, 13));
    expect(next).toHaveLength(25);
  });

  it('maps seven days with sunrise, sunset, rain totals and wind', () => {
    expect(f.daily).toHaveLength(7);
    expect(f.daily[0].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(typeof f.daily[0].precipSumMm).toBe('number');
    expect(typeof f.daily[0].windMaxKmh).toBe('number');
  });

  it('maps Reykjavík without air quality', () => {
    const r = mapOpenMeteo(REYKJAVIK, fcReykjavik as OpenMeteoForecast, null, '2026-11-23T14:00:00Z');
    expect(r.timezone).toBe('Atlantic/Reykjavik');
    expect(r.current.aqi).toBeNull();
    expect(r.hourly.every((h) => h.aqi === null)).toBe(true);
  });
});

describe('mapGeocoding', () => {
  it('maps search results to places', () => {
    expect(mapGeocoding(geoReykjavik)[0]).toMatchObject({ id: 'geo:3413829', name: 'Reykjavik', country: 'Iceland', region: 'Capital Region', timezone: 'Atlantic/Reykjavik' });
  });
  it('returns [] when nothing matches', () => {
    expect(mapGeocoding({})).toEqual([]);
  });
});

describe('createOpenMeteoProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests seven days with every hourly metric, and hourly air quality', () => {
    const url = new URL(forecastUrl(SF));
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('hourly')).toContain('wind_speed_10m');
    expect(url.searchParams.get('hourly')).toContain('uv_index');
    expect(new URL(airQualityUrl(SF)).searchParams.get('hourly')).toBe('us_aqi');
  });

  it('still returns a forecast when air quality fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => (input.includes('air-quality') ? new Response('oops', { status: 500 }) : new Response(JSON.stringify(fcSF), { status: 200 }))));
    const f = await createOpenMeteoProvider().getForecast(SF);
    expect(f.current.aqi).toBeNull();
    expect(f.daily).toHaveLength(7);
  });

  it('reports HTTP errors with the API reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: true, reason: 'Latitude must be in range of -90 to 90°.' }), { status: 400 })));
    await expect(createOpenMeteoProvider().getForecast({ ...SF, latitude: 200 })).rejects.toMatchObject({ kind: 'http', status: 400, message: expect.stringContaining('Latitude') });
  });

  it('retries a brief server error before giving up', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('air-quality')) return new Response(JSON.stringify(airSF), { status: 200 });
      calls++;
      return calls === 1 ? new Response('busy', { status: 503 }) : new Response(JSON.stringify(fcSF), { status: 200 });
    }));
    const f = await createOpenMeteoProvider().getForecast(SF);
    expect(calls).toBe(2);
    expect(f.daily).toHaveLength(7);
  });

  it('reports network failures in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(createOpenMeteoProvider().getForecast(SF)).rejects.toMatchObject({ kind: 'network' });
  });

  it('skips the geocoder for one-letter queries', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await createOpenMeteoProvider().searchPlaces('r')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
