import type { ReactNode } from 'react';
import { GlassPanel, PressureGauge, RangeMeter, SectionHeader, SunArc, TrendChart, WeatherIcon, WindCompass, cx, type IconName, type TrendPoint } from '../../design-system';
import type { Format } from '../../weather/format';
import {
  BEAUFORT,
  DEW_BANDS,
  POLLEN_NAMES,
  POLLUTANTS,
  beaufortBand,
  cloudWord,
  daylightChange,
  dewBand,
  euAqiLabel,
  feelsCauses,
  goldenHours,
  gustPeak,
  nextRain,
  pollenLevel,
  precipSplit,
  uvWindow,
  type PollenKey,
} from '../../weather/insights';
import { dayIndexOf, dayLabel, hoursOn, nextHours, nowIndex, sunInfo } from '../../weather/selectors';
import { formatDuration, formatShortDate } from '../../weather/time';
import type { Forecast, HourlyWeather } from '../../weather/types';
import { AQI_BANDS, aqiAdvice, aqiLabel, compassPoint, compassWords, feelsLikeNote, humidityComfort, uvAdvice, uvLabel, visibilityLabel, windForce } from '../../weather/units';
import { href, METRICS, type MetricKey } from '../router';
import { SERIES, pointsFor, type SeriesKey } from '../series';
import { useApp } from '../store';
import { Fact, ForecastGate, PageHeader, usePlaceForecast } from './common';

interface MetricView {
  value: ReactNode;
  unit?: string;
  qualifier?: string;
  text: string;
  visual?: ReactNode;
  chart?: { title: string; series: SeriesKey; points: TrendPoint[] };
  /** Panels between the hero and the chart (answers first). */
  facts?: ReactNode;
  /** Panels after the chart. */
  extra?: ReactNode;
}

export const METRIC_LABEL: Record<MetricKey, { title: string; icon: IconName }> = {
  feels: { title: 'Feels like', icon: 'thermometer' },
  wind: { title: 'Wind', icon: 'wind' },
  precip: { title: 'Precipitation', icon: 'umbrella' },
  uv: { title: 'UV index', icon: 'sun' },
  humidity: { title: 'Humidity', icon: 'humidity' },
  air: { title: 'Air quality', icon: 'air-quality' },
  sun: { title: 'Sun and daylight', icon: 'sunrise' },
  pressure: { title: 'Pressure', icon: 'pressure' },
  clouds: { title: 'Clouds and visibility', icon: 'cloud' },
};

export function MetricPage({ placeId, metric }: { placeId: string; metric: MetricKey }) {
  const pf = usePlaceForecast(placeId);
  const { fmt } = useApp();
  return (
    <div className="detail">
      <PageHeader
        title={METRIC_LABEL[metric].title}
        subtitle={pf.place ? `${pf.place.name}${pf.forecast ? ` · ${fmt.clock(pf.nowLocal)} local time` : ''}` : undefined}
        back={pf.place ? { href: href.today(pf.place.id), label: pf.place.name } : undefined}
      />
      <ForecastGate pf={pf}>
        {(f, nowLocal, place) => {
          const v = buildView(metric, f, nowLocal, fmt);
          const s = v.chart ? SERIES[v.chart.series] : null;
          return (
            <>
              <GlassPanel padding="xl" className="metric-hero">
                <div className="metric-hero-text">
                  <p className="metric-value">
                    {v.value}
                    {v.unit ? <span className="metric-unit">{v.unit}</span> : null}
                  </p>
                  {v.qualifier ? <p className="metric-qualifier">{v.qualifier}</p> : null}
                  <p className="metric-text">{v.text}</p>
                </div>
                {v.visual ? <div className="metric-visual">{v.visual}</div> : null}
              </GlassPanel>

              {v.facts}

              {v.chart && s && v.chart.points.length > 1 ? (
                <GlassPanel className="detail-chart" aria-labelledby="metric-chart-h">
                  <SectionHeader id="metric-chart-h" title={v.chart.title} />
                  <div className="detail-chart-scroll">
                    <div style={{ minWidth: v.chart.points.length * 30 }}>
                      <TrendChart
                        label={`${METRIC_LABEL[metric].title}, ${v.chart.title.toLowerCase()}`}
                        kind={s.kind}
                        min={s.min}
                        max={s.max}
                        points={v.chart.points}
                        labelEvery={3}
                        showValues={false}
                        height={190}
                      />
                    </div>
                  </div>
                </GlassPanel>
              ) : null}

              {v.extra}

              <nav className="metric-more" aria-label="Other conditions">
                <h2 className="nb-label">More conditions</h2>
                <div className="metric-chips">
                  {METRICS.filter((k) => k !== metric).map((k) => (
                    <a key={k} className="metric-chip" href={href.metric(place.id, k)}>
                      <WeatherIcon condition={METRIC_LABEL[k].icon} size={16} strokeWidth={1.8} tinted={false} />
                      {METRIC_LABEL[k].title}
                    </a>
                  ))}
                </div>
              </nav>
            </>
          );
        }}
      </ForecastGate>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function buildView(metric: MetricKey, f: Forecast, nowLocal: string, fmt: Format): MetricView {
  const c = f.current;
  const next24 = nextHours(f, nowLocal, 25);
  const todayIdx = dayIndexOf(f, nowLocal);
  const today = f.daily[todayIdx];
  const todayHours = hoursOn(f, nowLocal.slice(0, 10));
  const chart = (series: SeriesKey, title = 'Next 24 hours') => ({ title, series, points: pointsFor(series, next24, fmt, true) });

  switch (metric) {
    case 'feels': {
      const causes = feelsCauses(c, fmt);
      return {
        value: fmt.temp(c.feelsLikeC),
        qualifier: `Actual ${fmt.temp(c.tempC)}`,
        text: `${feelsLikeNote(c.tempC, c.feelsLikeC)} “Feels like” combines temperature, wind and humidity into how the air feels on your skin.`,
        facts: (
          <GlassPanel aria-labelledby="feels-why-h">
            <SectionHeader id="feels-why-h" title="Why" />
            <ul className="cause-list">
              {causes.map((k) => (
                <li key={k.title}>
                  <WeatherIcon condition={k.icon} size={20} strokeWidth={1.8} tinted={false} />
                  <span>
                    <strong>{k.title}.</strong> {k.text}
                  </span>
                </li>
              ))}
            </ul>
          </GlassPanel>
        ),
        chart: chart('feels'),
      };
    }

    case 'wind': {
      const w = fmt.wind(c.windKmh);
      const force = windForce(c.windKmh);
      const peak = gustPeak(todayHours.filter((h) => h.time.slice(0, 13) >= nowLocal.slice(0, 13)));
      const hr = f.hourly[nowIndex(f, nowLocal)];
      const levels = [
        { h: '10 m', kmh: c.windKmh, note: 'Street level' },
        { h: '80 m', kmh: hr?.wind80Kmh, note: 'Tall buildings' },
        { h: '120 m', kmh: hr?.wind120Kmh, note: 'Drones, turbines' },
        { h: '180 m', kmh: hr?.wind180Kmh, note: 'High-rise roofs' },
      ].filter((l): l is { h: string; kmh: number; note: string } => l.kmh != null);
      const maxLevel = Math.max(...levels.map((l) => l.kmh), 1);
      const band = beaufortBand(c.windKmh);
      return {
        value: w.text,
        unit: w.unit,
        qualifier: `${force.label} · from ${compassPoint(c.windDirectionDeg)}`,
        text: `Gusts up to ${fmt.windText(c.windGustKmh)} now.${peak?.windGustKmh ? ` Strongest gust for the rest of today: ${fmt.windText(peak.windGustKmh)} around ${fmt.clock(peak.time, true)}.` : ''} The arrow points the way the wind blows; it comes ${compassWords(c.windDirectionDeg)}.`,
        visual: <WindCompass degrees={c.windDirectionDeg} size={148} label={`Wind ${compassWords(c.windDirectionDeg)}`} />,
        facts: (
          <GlassPanel aria-labelledby="beaufort-h">
            <SectionHeader id="beaufort-h" title={`How strong is that? (${w.unit})`} />
            <ol className="scale-strip" aria-label="Wind strength scale">
              {BEAUFORT.map((b, k) => (
                <li key={b.label} className={cx('scale-step', k === band && 'scale-step-on')} aria-current={k === band ? 'true' : undefined}>
                  <span className="scale-word">{b.label}</span>
                  <span className="scale-range">{k === 0 ? `under ${fmt.wind(b.max).text}` : Number.isFinite(b.max) ? `${fmt.wind(BEAUFORT[k - 1].max).text}–${fmt.wind(b.max).text}` : `${fmt.wind(BEAUFORT[k - 1].max).text}+`}</span>
                </li>
              ))}
            </ol>
            <p className="detail-note">
              Now: <strong>{BEAUFORT[band].label}</strong>. {BEAUFORT[band].note}
            </p>
          </GlassPanel>
        ),
        chart: chart('wind'),
        extra:
          levels.length > 1 ? (
            <GlassPanel aria-labelledby="wind-high-h">
              <SectionHeader id="wind-high-h" title="Wind higher up" />
              <ul className="level-list">
                {levels.map((l) => (
                  <li key={l.h} className="level-row">
                    <span className="level-name">
                      {l.h}
                      <span className="muted">{l.note}</span>
                    </span>
                    <span className="level-bar" aria-hidden>
                      <span style={{ width: `${(l.kmh / maxLevel) * 100}%` }} />
                    </span>
                    <span className="level-val">{fmt.windText(l.kmh)}</span>
                  </li>
                ))}
              </ul>
              <p className="detail-note">Wind is usually stronger above the ground, where buildings and trees no longer slow it down.</p>
            </GlassPanel>
          ) : undefined,
      };
    }

    case 'precip': {
      const upcoming = f.daily.slice(todayIdx);
      const nr = nextRain(f, nowLocal);
      const split = precipSplit(todayHours);
      const week = upcoming.reduce((a, d) => a + (d.precipSumMm ?? 0), 0);
      const todayAmt = today?.precipSumMm != null ? fmt.precip(today.precipSumMm) : null;
      const weekAmt = fmt.precip(week);
      const nrDay = nr.time ? f.daily.findIndex((d) => d.date === nr.time!.slice(0, 10)) : -1;
      const nrWhen = nr.time ? (nrDay === todayIdx ? 'today' : nrDay === todayIdx + 1 ? 'tomorrow' : `on ${dayLabel(f, nrDay, nowLocal, true)}`) : '';
      const amount = (mm: number) => `${fmt.precip(mm).text} ${fmt.precip(mm).unit}`;
      return {
        value: nr.now ? 'Now' : nr.time ? fmt.clock(nr.time, true) : 'Dry',
        qualifier: nr.now ? 'Wet right now' : nr.time ? `Next rain or snow, ${nrWhen}` : 'No rain or snow this week',
        text: `${today?.precipProbability != null ? `${today.precipProbability}% chance today` : 'Chance today unknown'}${todayAmt ? (todayAmt.value > 0 ? `, about ${todayAmt.text} ${todayAmt.unit} in total.` : ', none expected.') : '.'}`,
        facts: (
          <>
            <div className="fact-grid fact-grid-3">
              <Fact icon="umbrella" label="Today" value={todayAmt ? `${todayAmt.text} ${todayAmt.unit}` : '—'} note={today?.precipProbability != null ? `${today.precipProbability}% chance` : 'Chance unknown'} />
              <Fact icon="umbrella" label="Next 7 days" value={`${weekAmt.text} ${weekAmt.unit}`} note={`${upcoming.filter((d) => (d.precipProbability ?? 0) >= 40).length} wet days`} />
              <Fact icon="info" label="Wet hours today" value={today?.precipHours != null ? `${today.precipHours} h` : '—'} note={today?.precipHours ? 'Hours with any rain or snow' : 'Dry all day'} />
            </div>
            <a className="nowcast-link nb-glass nb-r-xl" href={href.nowcast(f.place.id)}>
              <WeatherIcon condition="rain" size={20} strokeWidth={1.8} tinted={false} />
              <span>
                <strong>Next 2 hours</strong>
                <span className="muted">Rain every 15 minutes</span>
              </span>
              <WeatherIcon condition="chevron-right" size={16} strokeWidth={2} tinted={false} />
            </a>
            {split.known && split.rainMm + split.showersMm + split.snowCm > 0 ? (
              <GlassPanel aria-labelledby="precip-type-h">
                <SectionHeader id="precip-type-h" title="Today by type" />
                <ul className="type-list">
                  <li><span>Rain</span><span className="num">{amount(split.rainMm)}</span><span className="muted">Steady, from large cloud systems</span></li>
                  <li><span>Showers</span><span className="num">{amount(split.showersMm)}</span><span className="muted">Short bursts from heaped clouds</span></li>
                  <li><span>Snow</span><span className="num">{fmt.prefs.precip === 'in' ? `${(split.snowCm / 2.54).toFixed(1)} in` : `${split.snowCm.toFixed(1)} cm`}</span><span className="muted">Fresh snowfall depth</span></li>
                </ul>
              </GlassPanel>
            ) : null}
          </>
        ),
        chart: chart('precip', 'Chance by hour, next 24 hours'),
        extra: (
          <GlassPanel aria-labelledby="precip-week-h">
            <SectionHeader id="precip-week-h" title="This week" />
            <ul className="metric-list">
              {upcoming.map((d, k) => {
                const amt = d.precipSumMm != null ? fmt.precip(d.precipSumMm) : null;
                return (
                  <li key={d.date}>
                    <a href={href.day(f.place.id, todayIdx + k)} className="metric-list-row">
                      <span className="metric-list-name">{dayLabel(f, todayIdx + k, nowLocal)}</span>
                      <WeatherIcon condition={d.condition} size={20} label={d.conditionLabel} />
                      <span className="metric-list-bar" aria-hidden>
                        <span style={{ width: `${d.precipProbability ?? 0}%` }} />
                      </span>
                      <span className="metric-list-val precip">{d.precipProbability != null ? `${d.precipProbability}%` : '—'}</span>
                      <span className="metric-list-sub">{amt ? `${amt.text} ${amt.unit}` : ''}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        ),
      };
    }

    case 'uv': {
      const uv = c.uvIndex;
      const day = todayHours.filter((h) => h.isDay || (h.uvIndex ?? 0) > 0);
      const peak = day.reduce<HourlyWeather | null>((a, b) => ((b.uvIndex ?? 0) > (a?.uvIndex ?? -1) ? b : a), null);
      const win = uvWindow(f, nowLocal.slice(0, 10));
      const clear = Math.max(0, ...todayHours.map((h) => h.uvClearSky ?? 0));
      return {
        value: uv != null ? Math.round(uv) : '—',
        qualifier: uv != null ? uvLabel(uv) : 'Not available',
        text: `${uv != null ? uvAdvice(uv) : ''}${peak?.uvIndex ? ` Today peaks at ${Math.round(peak.uvIndex)} around ${fmt.clock(peak.time, true)}.` : ''}`.trim(),
        visual:
          uv != null ? (
            <div className="metric-meter">
              <RangeMeter scale="uv" value={uv} label={`UV index ${Math.round(uv)}`} />
              <MeterScale labels={['Low', 'Moderate', 'High', 'Very high', 'Extreme']} />
            </div>
          ) : undefined,
        facts: (
          <div className="fact-grid fact-grid-2">
            <Fact icon="sun" label="Protect" value={win ? `${fmt.clock(win.from, true)} – ${fmt.clock(win.to, true)}` : 'Not needed'} note={win ? 'UV 3 or more: hat, shade, SPF 30+' : 'UV stays low today'} />
            <Fact icon="cloud" label="Cloudless sky" value={clear ? String(Math.round(clear)) : '—'} note={clear ? `Peak if the clouds clear (${uvLabel(clear).toLowerCase()})` : 'Not available'} />
          </div>
        ),
        chart: day.length > 1 ? { title: 'Through today', series: 'uv', points: pointsFor('uv', day, fmt, false) } : undefined,
      };
    }

    case 'humidity': {
      const band = dewBand(c.dewPointC);
      return {
        value: `${Math.round(c.humidity)}%`,
        qualifier: `Dew point ${fmt.temp(c.dewPointC)}`,
        text: `${humidityComfort(c.dewPointC)} The dew point is the better guide to how muggy it feels: the higher it is, the stickier the air.`,
        visual: (
          <div className="metric-meter">
            <RangeMeter value={c.humidity} label={`Humidity ${Math.round(c.humidity)}%`} />
            <MeterScale labels={['0%', '50%', '100%']} />
          </div>
        ),
        facts: (
          <GlassPanel aria-labelledby="comfort-h">
            <SectionHeader id="comfort-h" title="Comfort, by dew point" />
            <ol className="scale-strip" aria-label="Comfort scale">
              {DEW_BANDS.map((b, k) => (
                <li key={b.label} className={cx('scale-step', k === band && 'scale-step-on')} aria-current={k === band ? 'true' : undefined}>
                  <span className="scale-word">{b.label}</span>
                  <span className="scale-range">{k === 0 ? `under ${fmt.temp(b.max)}` : Number.isFinite(b.max) ? `${fmt.temp(DEW_BANDS[k - 1].max)}–${fmt.temp(b.max)}` : `${fmt.temp(DEW_BANDS[k - 1].max)}+`}</span>
                </li>
              ))}
            </ol>
          </GlassPanel>
        ),
        chart: chart('humidity'),
      };
    }

    case 'air': {
      const aqi = c.aqi;
      const hasHourly = next24.some((h) => h.aqi != null);
      const p = c.pollutants;
      const pollen = c.pollen;
      return {
        value: aqi != null ? Math.round(aqi) : '—',
        qualifier: aqi != null ? `${aqiLabel(aqi)} · US AQI` : 'Not available for this place',
        text: `${aqi != null ? aqiAdvice(aqi) : 'This weather source has no air-quality reading here.'}${c.euAqi != null ? ` European index: ${Math.round(c.euAqi)} (${euAqiLabel(c.euAqi).toLowerCase()}).` : ''}`,
        visual:
          aqi != null ? (
            <div className="metric-meter">
              <RangeMeter scale="aqi" value={aqi} label={`Air quality index ${Math.round(aqi)}`} />
              <MeterScale labels={['0', '50', '100', '150+']} />
            </div>
          ) : undefined,
        facts: p ? (
          <GlassPanel aria-labelledby="pollutants-h">
            <SectionHeader id="pollutants-h" title="Pollutants" />
            <ul className="level-list">
              {POLLUTANTS.map((d) => {
                const v = p[d.key];
                if (v == null) return null;
                const ratio = v / d.guideline;
                return (
                  <li key={d.key} className="level-row level-row-3">
                    <span className="level-name">
                      {d.name} <span className="muted">{d.short}</span>
                    </span>
                    <span className={cx('level-bar', 'level-guide', ratio > 1 && 'level-over')} aria-hidden>
                      <span style={{ width: `${Math.min(ratio / 2, 1) * 100}%` }} />
                    </span>
                    <span className="level-val">
                      {Math.round(v)} <span className="muted">µg/m³</span>
                    </span>
                    <span className="level-note">{ratio > 1 ? `${ratio.toFixed(1)}× the WHO guideline` : 'Within the WHO guideline'}</span>
                  </li>
                );
              })}
            </ul>
            <p className="detail-note">The mark in each bar is the World Health Organization guideline level.</p>
          </GlassPanel>
        ) : undefined,
        chart: hasHourly ? chart('aqi') : undefined,
        extra: (
          <>
            <GlassPanel aria-labelledby="pollen-h">
              <SectionHeader id="pollen-h" title="Pollen" />
              {pollen ? (
                <ul className="pollen-list">
                  {(Object.keys(POLLEN_NAMES) as PollenKey[]).map((k) => {
                    const lv = pollenLevel(pollen[k]);
                    return (
                      <li key={k} className={`pollen-${lv.level}`}>
                        <span>{POLLEN_NAMES[k]}</span>
                        <span className="pollen-dots" aria-hidden>
                          {[1, 2, 3, 4].map((n) => (
                            <i key={n} className={n <= lv.level ? 'on' : undefined} />
                          ))}
                        </span>
                        <span className="pollen-word">{lv.label}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="detail-note">Pollen forecasts are only available for Europe, so there is no reading here. That doesn’t mean the count is zero.</p>
              )}
            </GlassPanel>
            <GlassPanel aria-labelledby="aqi-bands-h">
              <SectionHeader id="aqi-bands-h" title="What the numbers mean" />
              <ul className="aqi-bands">
                {AQI_BANDS.map((b, k) => {
                  const lo = k === 0 ? 0 : AQI_BANDS[k - 1].max + 1;
                  const on = aqi != null && aqi >= lo && aqi <= b.max;
                  return (
                    <li key={b.label} className={cx('aqi-band', on && 'aqi-band-on')}>
                      <span className={`aqi-swatch aqi-swatch-${Math.min(k + 1, 5)}`} aria-hidden />
                      <span className="aqi-range">
                        {lo}–{b.max}
                      </span>
                      <span className="aqi-label">
                        {b.label}
                        {on ? <span className="nb-sr"> (current)</span> : null}
                      </span>
                      <span className="aqi-note">{b.note}</span>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          </>
        ),
      };
    }

    case 'sun': {
      const s = sunInfo(f, nowLocal, fmt);
      const g = goldenHours(today);
      const change = daylightChange(f, todayIdx);
      const changeText = change
        ? change.minutes === 0
          ? `Same length as ${change.vs}.`
          : change.vs === 'yesterday'
            ? `${formatDuration(Math.abs(change.minutes))} ${change.minutes > 0 ? 'longer' : 'shorter'} than yesterday.`
            : `Tomorrow is ${formatDuration(Math.abs(change.minutes))} ${change.minutes > 0 ? 'longer' : 'shorter'}.`
        : '';
      const sunshine = today?.sunshineSec != null ? Math.round(today.sunshineSec / 60) : null;
      return {
        value: s.progress > 0 && s.progress < 1 ? s.sunset ?? '—' : s.sunrise ?? '—',
        qualifier: s.progress > 0 && s.progress < 1 ? 'Sunset' : 'Sunrise',
        text: `${s.note}.${s.daylightMinutes != null ? ` ${formatDuration(s.daylightMinutes)} of daylight today.` : ''} ${changeText}`.trim(),
        visual: s.sunrise && s.sunset ? <div className="metric-sun"><SunArc progress={s.progress} sunrise={s.sunrise} sunset={s.sunset} /></div> : undefined,
        facts: (
          <div className="fact-grid fact-grid-3">
            <Fact icon="sunrise" label="Golden hour, morning" value={g ? `${fmt.clock(g.morning[0])}` : '—'} note={g ? `Until ${fmt.clock(g.morning[1])} (approx.)` : 'No sunrise today'} />
            <Fact icon="sunrise" label="Golden hour, evening" value={g ? `${fmt.clock(g.evening[0])}` : '—'} note={g ? `Until sunset, ${fmt.clock(g.evening[1])}` : 'No sunset today'} />
            <Fact icon="sun" label="Sunshine" value={sunshine != null ? formatDuration(sunshine) : '—'} note={sunshine != null && s.daylightMinutes ? `${Math.round((sunshine / s.daylightMinutes) * 100)}% of daylight` : 'Not available'} />
          </div>
        ),
        extra: (
          <GlassPanel aria-labelledby="sun-week-h" padding="md">
            <SectionHeader id="sun-week-h" title="This week" />
            <div className="detail-table-scroll">
              <table className="hour-table sun-table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Sunrise</th>
                    <th scope="col">Sunset</th>
                    <th scope="col">Daylight</th>
                    <th scope="col">Sunshine</th>
                  </tr>
                </thead>
                <tbody>
                  {f.daily.slice(todayIdx).map((d, k) => {
                    const info = sunInfo(f, nowLocal, fmt, todayIdx + k);
                    return (
                      <tr key={d.date}>
                        <th scope="row">
                          {dayLabel(f, todayIdx + k, nowLocal)} <span className="muted">{formatShortDate(d.date)}</span>
                        </th>
                        <td className="num">{info.sunrise ?? '—'}</td>
                        <td className="num">{info.sunset ?? '—'}</td>
                        <td className="num">{info.daylightMinutes != null ? formatDuration(info.daylightMinutes) : '—'}</td>
                        <td className="num">{d.sunshineSec != null ? formatDuration(d.sunshineSec / 60) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        ),
      };
    }

    case 'pressure': {
      const p = fmt.pressure(c.pressureHpa);
      const meaning =
        c.pressureTrend === 'rising' ? 'Rising pressure usually means clearing, calmer weather.' : c.pressureTrend === 'falling' ? 'Falling pressure often comes before wind and rain.' : 'Steady pressure: little change on the way.';
      const i = nowIndex(f, nowLocal);
      const start = Math.max(0, i - 24);
      const span = f.hourly.slice(start, i + 25);
      const points = pointsFor('pressure', span, fmt, false).map((pt, k) => (k === i - start ? { ...pt, label: 'Now' } : pt));
      const past = f.hourly[start]?.pressureHpa;
      const change = past != null && i - start >= 12 ? Math.round(c.pressureHpa - past) : null;
      return {
        value: p.text,
        unit: p.unit,
        qualifier: cap(c.pressureTrend),
        text: `${meaning}${change != null ? ` ${change === 0 ? 'Unchanged' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} hPa`} over the last ${i - start} hours.` : ''} Sea-level pressure; the usual range is about 980 to 1040 hPa.`,
        visual: <PressureGauge hpa={c.pressureHpa} size={170} />,
        chart: { title: i - start >= 12 ? `Past ${i - start} hours and next 24` : 'Next 24 hours', series: 'pressure', points },
      };
    }

    case 'clouds': {
      const hr = f.hourly[nowIndex(f, nowLocal)];
      const cover = hr?.cloudCover;
      const vis = c.visibilityKm != null ? fmt.distance(c.visibilityKm) : null;
      const sunshine = today?.sunshineSec != null ? Math.round(today.sunshineSec / 60) : null;
      const daylight = today?.daylightSec != null ? Math.round(today.daylightSec / 60) : null;
      const layers = [
        { name: 'High', note: 'above 6 km, thin and wispy', v: hr?.cloudHigh },
        { name: 'Middle', note: '2–6 km', v: hr?.cloudMid },
        { name: 'Low', note: 'below 2 km, brings rain and gloom', v: hr?.cloudLow },
      ];
      const hasLayers = layers.some((l) => l.v != null);
      return {
        value: cover != null ? Math.round(cover) : vis ? vis.text : '—',
        unit: cover != null ? '%' : vis?.unit,
        qualifier: cover != null ? cloudWord(cover) : 'Visibility',
        text: `${sunshine != null ? `${formatDuration(sunshine)} of sunshine expected today${daylight ? `, out of ${formatDuration(daylight)} of daylight` : ''}. ` : ''}${vis ? `You can see about ${vis.text} ${vis.unit}: ${visibilityLabel(c.visibilityKm!).toLowerCase()}` : ''}`.trim(),
        visual: hasLayers ? (
          <ul className="layer-stack" aria-label="Cloud layers now">
            {layers.map((l) => (
              <li key={l.name}>
                <span className="layer-name">{l.name}</span>
                <span className="level-bar" aria-hidden>
                  <span style={{ width: `${l.v ?? 0}%` }} />
                </span>
                <span className="layer-val">{l.v != null ? `${Math.round(l.v)}%` : '—'}</span>
              </li>
            ))}
          </ul>
        ) : undefined,
        facts: (
          <div className="fact-grid fact-grid-3">
            <Fact icon="visibility" label="Visibility" value={vis ? `${vis.text} ${vis.unit}` : '—'} note={c.visibilityKm != null ? visibilityLabel(c.visibilityKm).replace(/\.$/, '') : 'Not available'} />
            <Fact icon="sun" label="Sunshine today" value={sunshine != null ? formatDuration(sunshine) : '—'} note={sunshine != null && daylight ? `${Math.round((sunshine / daylight) * 100)}% of daylight` : 'Not available'} />
            <Fact icon="cloud" label="Cloud layers" value={hasLayers ? layers.reduce((a, b) => ((b.v ?? 0) > (a.v ?? 0) ? b : a)).name : '—'} note={hasLayers ? 'The thickest layer right now' : 'Not available'} />
          </div>
        ),
        chart: next24.some((h) => h.cloudCover != null) ? chart('clouds', 'Cloud cover, next 24 hours') : chart('visibility', 'Visibility, next 24 hours'),
        extra: next24.some((h) => h.cloudCover != null) && next24.some((h) => h.visibilityKm != null) ? (
          <GlassPanel className="detail-chart" aria-labelledby="vis-chart-h">
            <SectionHeader id="vis-chart-h" title="Visibility, next 24 hours" />
            <div className="detail-chart-scroll">
              <div style={{ minWidth: next24.length * 30 }}>
                <TrendChart label="Visibility by hour" kind="line" min={0} points={pointsFor('visibility', next24, fmt, true)} labelEvery={3} showValues={false} height={150} />
              </div>
            </div>
          </GlassPanel>
        ) : undefined,
      };
    }
  }
}

function MeterScale({ labels }: { labels: string[] }) {
  return (
    <div className="meter-scale" aria-hidden>
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
