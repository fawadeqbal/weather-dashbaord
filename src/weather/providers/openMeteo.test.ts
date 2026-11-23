import { afterEach, describe, expect, it, vi } from 'vitest';
import airSF from './__fixtures__/air-quality-san-francisco.json';
import fcReykjavik from './__fixtures__/forecast-reykjavik.json';
import fcSF from './__fixtures__/forecast-san-francisco.json';
import geoReykjavik from './__fixtures__/geocoding-reykjavik.json';
import { airQualityUrl, createOpenMeteoProvider, forecastUrl, mapGeocoding, mapOpenMeteo, outlookUrl, type OpenMeteoAirQuality, type OpenMeteoForecast } from './openMeteo';
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

describe('mapOpenMeteo (extended fields)', () => {
  // The fixtures predate the extra fields, so add synthetic ones of the same shape.
  const fc = structuredClone(fcSF) as OpenMeteoForecast;
  const n = fc.hourly.time.length;
  const fill = (v: number) => Array.from({ length: n }, () => v);
  Object.assign(fc.hourly, { cloud_cover: fill(60), cloud_cover_low: fill(40), cloud_cover_mid: fill(20), cloud_cover_high: fill(10), uv_index_clear_sky: fill(4), rain: fill(0.3), showers: fill(0.1), snowfall: fill(0), wind_speed_80m: fill(30), wind_speed_120m: fill(34), wind_speed_180m: fill(38) });
  const days = fc.daily.time.length;
  Object.assign(fc.daily, { sunshine_duration: Array(days).fill(25200), daylight_duration: Array(days).fill(36000), precipitation_hours: Array(days).fill(3) });
  fc.minutely_15 = { time: ['2026-11-23T14:00', '2026-11-23T14:15'], precipitation: [0.2, null] };
  const air = structuredClone(airSF) as OpenMeteoAirQuality;
  Object.assign(air.current!, { european_aqi: 22, pm2_5: 6.1, pm10: 9, ozone: 50, nitrogen_dioxide: 12, sulphur_dioxide: 1, carbon_monoxide: 200, alder_pollen: null, birch_pollen: null, grass_pollen: null, mugwort_pollen: null, olive_pollen: null, ragweed_pollen: null });
  const f = mapOpenMeteo(SF, fc, air, '2026-11-23T14:00:00Z');

  it('maps cloud layers, clear-sky UV, rain types and wind higher up', () => {
    expect(f.hourly[5]).toMatchObject({ cloudCover: 60, cloudLow: 40, cloudMid: 20, cloudHigh: 10, uvClearSky: 4, rainMm: 0.3, showersMm: 0.1, snowfallCm: 0, wind80Kmh: 30, wind120Kmh: 34, wind180Kmh: 38 });
  });

  it('maps sunshine, daylight and wet hours per day', () => {
    expect(f.daily[0]).toMatchObject({ sunshineSec: 25200, daylightSec: 36000, precipHours: 3 });
  });

  it('maps 15-minute precipitation', () => {
    expect(f.minutely15).toEqual([{ time: '2026-11-23T14:00', precipMm: 0.2 }, { time: '2026-11-23T14:15', precipMm: null }]);
  });

  it('maps pollutants, and leaves pollen null outside Europe', () => {
    expect(f.current.euAqi).toBe(22);
    expect(f.current.pollutants).toMatchObject({ pm25: 6.1, o3: 50, co: 200 });
    expect(f.current.pollen).toBeNull();
  });

  it('leaves extras undefined when the API does not send them', () => {
    const plain = mapOpenMeteo(SF, fcSF as OpenMeteoForecast, null, '2026-11-23T14:00:00Z');
    expect(plain.hourly[0].cloudCover ?? null).toBeNull();
    expect(plain.minutely15 ?? []).toEqual([]);
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

  it('asks for yesterday, 15-minute rain and the extra fields', () => {
    const url = new URL(forecastUrl(SF));
    expect(url.searchParams.get('past_days')).toBe('1');
    expect(url.searchParams.get('minutely_15')).toBe('precipitation');
    expect(url.searchParams.get('hourly')).toContain('cloud_cover_low');
    expect(url.searchParams.get('daily')).toContain('sunshine_duration');
    expect(new URL(airQualityUrl(SF)).searchParams.get('current')).toContain('grass_pollen');
    expect(new URL(outlookUrl(SF)).searchParams.get('forecast_days')).toBe('16');
  });

  it('falls back to the core fields when the extended request is rejected', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      urls.push(input);
      if (input.includes('air-quality')) return new Response(JSON.stringify(airSF), { status: 200 });
      return input.includes('past_days') ? new Response(JSON.stringify({ error: true, reason: 'Cannot initialize WeatherVariable from invalid String value' }), { status: 400 }) : new Response(JSON.stringify(fcSF), { status: 200 });
    }));
    const f = await createOpenMeteoProvider().getForecast(SF);
    expect(f.daily).toHaveLength(7);
    expect(urls.filter((u) => !u.includes('air-quality'))).toHaveLength(2);
  });

  it('loads the 16-day outlook', async () => {
    const daily = { ...fcSF.daily };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ daily }), { status: 200 })));
    const days = await createOpenMeteoProvider().getOutlook!(SF);
    expect(days).toHaveLength(fcSF.daily.time.length);
    expect(days[0].date).toBe(fcSF.daily.time[0]);
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
