import { afterEach, describe, expect, it, vi } from 'vitest';
import airSF from './__fixtures__/air-quality-san-francisco.json';
import fcReykjavik from './__fixtures__/forecast-reykjavik.json';
import fcSF from './__fixtures__/forecast-san-francisco.json';
import geoReykjavik from './__fixtures__/geocoding-reykjavik.json';
import { createOpenMeteoProvider, forecastUrl, mapGeocoding, mapOpenMeteo, type OpenMeteoForecast } from './openMeteo';
import { DEFAULT_PLACES } from '../places';

const SF = DEFAULT_PLACES[0];
const REYKJAVIK = DEFAULT_PLACES[4];

describe('mapOpenMeteo (real responses)', () => {
  const f = mapOpenMeteo(SF, fcSF as OpenMeteoForecast, airSF, '2026-11-23T08:30:00Z');

  it('maps current conditions in metric units', () => {
    expect(f.timezone).toBe('America/Los_Angeles');
    expect(f.current.time).toBe(fcSF.current.time);
    expect(f.current.tempC).toBe(fcSF.current.temperature_2m);
    expect(f.current.visibilityKm).toBeCloseTo(fcSF.current.visibility / 1000);
    expect(f.current.isDay).toBe(fcSF.current.is_day === 1);
    expect(f.current.aqi).toBe(airSF.current.us_aqi);
    expect(['rising', 'steady', 'falling']).toContain(f.current.pressureTrend);
  });

  it('uses night icons at night', () => {
    // The fixture was captured at 00:30 local with WMO code 0 (clear).
    expect(fcSF.current.is_day).toBe(0);
    expect(f.current.condition).toBe('moon');
    expect(f.current.conditionLabel).toBe('Clear');
  });

  it('starts the hourly series at the current hour and covers 24 hours', () => {
    expect(f.hourly[0].time.slice(0, 13)).toBe(fcSF.current.time.slice(0, 13));
    expect(f.hourly.length).toBeGreaterThanOrEqual(25);
  });

  it('maps seven days with sunrise and sunset', () => {
    expect(f.daily).toHaveLength(7);
    expect(f.daily[0].sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(f.daily[1].condition).toBe('rain'); // WMO 61 in the fixture
  });

  it('maps drizzle in Reykjavík to the rain icon', () => {
    const r = mapOpenMeteo(REYKJAVIK, fcReykjavik as OpenMeteoForecast, null, '2026-11-23T08:30:00Z');
    expect(fcReykjavik.current.weather_code).toBe(53);
    expect(r.current.condition).toBe('rain');
    expect(r.current.conditionLabel).toBe('Drizzle');
    expect(r.current.aqi).toBeNull();
  });
});

describe('mapGeocoding', () => {
  it('maps search results to places', () => {
    const places = mapGeocoding(geoReykjavik);
    expect(places[0]).toMatchObject({ id: 'geo:3413829', name: 'Reykjavik', country: 'Iceland', region: 'Capital Region', timezone: 'Atlantic/Reykjavik' });
  });
  it('returns [] when nothing matches', () => {
    expect(mapGeocoding({})).toEqual([]);
  });
});

describe('createOpenMeteoProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the forecast with auto time zone and 25 hours', () => {
    const url = new URL(forecastUrl(SF));
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_hours')).toBe('25');
    expect(url.searchParams.get('current')).toContain('weather_code');
  });

  it('still returns a forecast when air quality fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('air-quality')) return new Response('oops', { status: 500 });
      return new Response(JSON.stringify(fcSF), { status: 200 });
    }));
    const f = await createOpenMeteoProvider().getForecast(SF);
    expect(f.current.aqi).toBeNull();
    expect(f.daily).toHaveLength(7);
  });

  it('reports HTTP errors with the API reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: true, reason: 'Latitude must be in range of -90 to 90°.' }), { status: 400 })));
    await expect(createOpenMeteoProvider().getForecast({ ...SF, latitude: 200 })).rejects.toMatchObject({ kind: 'http', status: 400, message: expect.stringContaining('Latitude') });
  });

  it('reports network failures in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(createOpenMeteoProvider().getForecast(SF)).rejects.toMatchObject({ kind: 'network' });
  });

  it('skips the geocoder for one-letter queries', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await createOpenMeteoProvider().searchPlaces('r')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
