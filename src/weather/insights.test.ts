import { describe, expect, it } from 'vitest';
import { makeFormat, METRIC } from './format';
import { addMinutes, alertAdvice, daylightChange, dewBand, feelsCauses, intensityOf, nextRain, nowcastSteps, nowcastSummary, pollenLevel, uvWindow } from './insights';
import { DEFAULT_PLACES } from './places';
import { buildSampleForecast, SAMPLES } from './providers/mock';
import type { Forecast } from './types';

const fmt = makeFormat(METRIC);
const london = DEFAULT_PLACES[3];
const sf = DEFAULT_PLACES[0];
const sample = (p: typeof sf): Forecast => buildSampleForecast(p, SAMPLES[p.id], '2026-11-23T14:00:00Z');

describe('insights', () => {
  it('adds minutes across midnight and month ends', () => {
    expect(addMinutes('2026-11-30T23:50', 15)).toBe('2026-12-01T00:05');
    expect(addMinutes('2026-11-23T00:10', -20)).toBe('2026-11-22T23:50');
  });

  it('names rain intensity in words', () => {
    expect(intensityOf(0)).toBe('none');
    expect(intensityOf(1)).toBe('light');
    expect(intensityOf(5)).toBe('moderate');
    expect(intensityOf(10)).toBe('heavy');
  });

  it('summarises the next two hours in one sentence', () => {
    const t = (k: number) => addMinutes('2026-11-23T14:00', k * 15);
    const wetThenDry = [3, 3, 0, 0].map((r, k) => ({ time: t(k), rateMmH: r, intensity: intensityOf(r) }));
    expect(nowcastSummary(wetThenDry, fmt)).toBe('Moderate rain now, stopping around 14:30.');
    const dryThenWet = [0, 0, 1, 1].map((r, k) => ({ time: t(k), rateMmH: r, intensity: intensityOf(r) }));
    expect(nowcastSummary(dryThenWet, fmt)).toBe('Light rain starting around 14:30.');
    expect(nowcastSummary([], fmt)).toMatch(/No short-range data/);
  });

  it('uses 15-minute steps for two hours when the provider has them', () => {
    const f = sample(london);
    const { steps, resolution } = nowcastSteps(f, f.current.time);
    expect(resolution).toBe(15);
    expect(steps).toHaveLength(8);
    expect(steps[0].intensity).not.toBe('none');
  });

  it('falls back to hourly steps without 15-minute data', () => {
    const f = { ...sample(sf), minutely15: [] };
    expect(nowcastSteps(f, f.current.time).resolution).toBe(60);
  });

  it('finds the next wet hour', () => {
    const f = sample(london);
    expect(nextRain(f, f.current.time).now).toBe(true);
  });

  it('finds the UV protection window', () => {
    const f = sample(sf);
    const w = uvWindow(f, f.current.time.slice(0, 10));
    expect(w).not.toBeNull();
    expect(w!.from < w!.to).toBe(true);
  });

  it('turns pollen counts and dew points into words', () => {
    expect(pollenLevel(null).label).toBe('None');
    expect(pollenLevel(25).label).toBe('Moderate');
    expect(pollenLevel(500).label).toBe('Very high');
    expect(dewBand(5)).toBe(0);
    expect(dewBand(25)).toBe(4);
  });

  it('explains wind chill', () => {
    const f = sample(london);
    const causes = feelsCauses({ ...f.current, tempC: 5, feelsLikeC: 1, windKmh: 30 }, fmt);
    expect(causes[0].title).toBe('Wind chill');
    expect(causes[0].text).toContain('4°C');
  });

  it('compares daylight with the next day when yesterday is missing', () => {
    const f = sample(sf);
    expect(daylightChange(f, 0)?.vs).toBe('tomorrow');
  });

  it('gives practical advice for a warning', () => {
    expect(alertAdvice('Yellow rain warning')[0]).toMatch(/flood water/);
    expect(alertAdvice('Something unusual')).toHaveLength(2);
  });
});
