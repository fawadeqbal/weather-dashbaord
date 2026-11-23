import type { ReactNode } from 'react';
import { GlassPanel, PressureGauge, RangeMeter, SectionHeader, SunArc, TrendChart, WeatherIcon, WindCompass, cx, type IconName } from '../../design-system';
import type { Format } from '../../weather/format';
import { dayIndexOf, dayLabel, hoursOn, nextHours, sunInfo } from '../../weather/selectors';
import { formatDuration, formatShortDate } from '../../weather/time';
import type { Forecast, HourlyWeather } from '../../weather/types';
import {
  AQI_BANDS,
  aqiAdvice,
  aqiLabel,
  compassPoint,
  compassWords,
  feelsLikeNote,
  humidityComfort,
  uvAdvice,
  uvLabel,
  visibilityLabel,
  windForce,
} from '../../weather/units';
import { href, METRICS, type MetricKey } from '../router';
import { pointsFor, type SeriesKey } from '../series';
import { useApp } from '../store';
import { ForecastGate, PageHeader, usePlaceForecast } from './common';

interface MetricView {
  title: string;
  icon: IconName;
  value: ReactNode;
  unit?: string;
  qualifier?: string;
  text: string;
  visual?: ReactNode;
  chart?: { title: string; series: SeriesKey; hours: HourlyWeather[]; nowFirst: boolean };
  extra?: ReactNode;
}

export const METRIC_LABEL: Record<MetricKey, { title: string; icon: IconName }> = {
  feels: { title: 'Feels like', icon: 'thermometer' },
  wind: { title: 'Wind', icon: 'wind' },
  precip: { title: 'Precipitation', icon: 'umbrella' },
  uv: { title: 'UV index', icon: 'sun' },
  humidity: { title: 'Humidity', icon: 'humidity' },
  air: { title: 'Air quality', icon: 'air-quality' },
  sun: { title: 'Sunrise and sunset', icon: 'sunrise' },
  pressure: { title: 'Pressure', icon: 'pressure' },
  visibility: { title: 'Visibility', icon: 'visibility' },
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

              {v.chart && v.chart.hours.length > 1 ? (
                <GlassPanel className="detail-chart" aria-labelledby="metric-chart-h">
                  <SectionHeader id="metric-chart-h" title={v.chart.title} />
                  <div className="detail-chart-scroll">
                    <div style={{ minWidth: v.chart.hours.length * 30 }}>
                      <TrendChart
                        label={`${v.title}, ${v.chart.title.toLowerCase()}`}
                        kind={metric === 'precip' || metric === 'uv' || metric === 'air' ? 'bar' : 'line'}
                        min={metric === 'precip' || metric === 'humidity' ? 0 : metric === 'uv' ? 0 : undefined}
                        max={metric === 'precip' || metric === 'humidity' ? 100 : metric === 'uv' ? 11 : undefined}
                        points={pointsFor(v.chart.series, v.chart.hours, fmt, v.chart.nowFirst)}
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

function buildView(metric: MetricKey, f: Forecast, nowLocal: string, fmt: Format): MetricView {
  const c = f.current;
  const next24 = nextHours(f, nowLocal, 25);
  const todayIdx = dayIndexOf(f, nowLocal);
  const today = f.daily[todayIdx];
  const chart = (series: SeriesKey, title = 'Next 24 hours') => ({ title, series, hours: next24, nowFirst: true });
  const { title, icon } = METRIC_LABEL[metric];

  switch (metric) {
    case 'feels':
      return {
        title, icon,
        value: fmt.temp(c.feelsLikeC),
        qualifier: `Actual ${fmt.temp(c.tempC)}`,
        text: `${feelsLikeNote(c.tempC, c.feelsLikeC)} “Feels like” combines temperature, wind and humidity into how the air feels on your skin.`,
        chart: chart('feels'),
      };
    case 'wind': {
      const w = fmt.wind(c.windKmh);
      const force = windForce(c.windKmh);
      return {
        title, icon,
        value: w.text,
        unit: w.unit,
        qualifier: `${force.label} · from ${compassPoint(c.windDirectionDeg)}`,
        text: `Gusts up to ${fmt.windText(c.windGustKmh)}. The arrow points the way the wind is blowing; it comes ${compassWords(c.windDirectionDeg)}. Force ${force.force} on the Beaufort scale.`,
        visual: <WindCompass degrees={c.windDirectionDeg} size={148} label={`Wind ${compassWords(c.windDirectionDeg)}`} />,
        chart: chart('wind'),
      };
    }
    case 'precip': {
      const upcoming = f.daily.slice(todayIdx);
      return {
        title, icon,
        value: today?.precipProbability != null ? `${today.precipProbability}%` : '—',
        qualifier: today?.precipSumMm != null ? (fmt.precip(today.precipSumMm).value > 0 ? `${fmt.precip(today.precipSumMm).text} ${fmt.precip(today.precipSumMm).unit} expected today` : 'None expected today') : 'Chance today',
        text: 'The chance that rain, snow or drizzle falls at a given hour, and how much is expected over the day.',
        chart: chart('precip'),
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
      const day = hoursOn(f, nowLocal.slice(0, 10)).filter((h) => h.isDay || (h.uvIndex ?? 0) > 0);
      const peak = day.reduce<HourlyWeather | null>((a, b) => ((b.uvIndex ?? 0) > (a?.uvIndex ?? -1) ? b : a), null);
      return {
        title, icon,
        value: uv != null ? Math.round(uv) : '—',
        qualifier: uv != null ? uvLabel(uv) : 'Not available',
        text: `${uv != null ? uvAdvice(uv) : ''}${peak?.uvIndex ? ` Today peaks at ${Math.round(peak.uvIndex)} around ${fmt.clock(peak.time, true)}.` : ''}`.trim(),
        visual: uv != null ? <div className="metric-meter"><RangeMeter scale="uv" value={uv} label={`UV index ${Math.round(uv)}`} /><MeterScale labels={['0', '3', '6', '8', '11+']} /></div> : undefined,
        chart: day.length > 1 ? { title: 'Through today', series: 'uv', hours: day, nowFirst: false } : undefined,
      };
    }
    case 'humidity':
      return {
        title, icon,
        value: `${Math.round(c.humidity)}%`,
        qualifier: `Dew point ${fmt.temp(c.dewPointC)}`,
        text: `${humidityComfort(c.dewPointC)} The dew point is the better guide to how muggy it feels: the higher it is, the stickier the air.`,
        visual: <div className="metric-meter"><RangeMeter value={c.humidity} label={`Humidity ${Math.round(c.humidity)}%`} /><MeterScale labels={['0%', '50%', '100%']} /></div>,
        chart: chart('humidity'),
      };
    case 'air': {
      const aqi = c.aqi;
      const hasHourly = next24.some((h) => h.aqi != null);
      return {
        title, icon,
        value: aqi != null ? Math.round(aqi) : '—',
        qualifier: aqi != null ? `${aqiLabel(aqi)} · US AQI` : 'Not available for this place',
        text: aqi != null ? aqiAdvice(aqi) : 'This weather source has no air-quality reading here.',
        visual: aqi != null ? <div className="metric-meter"><RangeMeter scale="aqi" value={aqi} label={`Air quality index ${Math.round(aqi)}`} /><MeterScale labels={['0', '50', '100', '150+']} /></div> : undefined,
        chart: hasHourly ? chart('aqi') : undefined,
        extra: (
          <GlassPanel aria-labelledby="aqi-bands-h">
            <SectionHeader id="aqi-bands-h" title="What the numbers mean" />
            <ul className="aqi-bands">
              {AQI_BANDS.map((b, k) => {
                const lo = k === 0 ? 0 : AQI_BANDS[k - 1].max + 1;
                const on = aqi != null && aqi >= lo && aqi <= b.max;
                return (
                  <li key={b.label} className={cx('aqi-band', on && 'aqi-band-on')}>
                    <span className={`aqi-swatch aqi-swatch-${Math.min(k + 1, 5)}`} aria-hidden />
                    <span className="aqi-range">{lo}–{b.max}</span>
                    <span className="aqi-label">{b.label}{on ? <span className="nb-sr"> (current)</span> : null}</span>
                    <span className="aqi-note">{b.note}</span>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        ),
      };
    }
    case 'sun': {
      const s = sunInfo(f, nowLocal, fmt);
      return {
        title, icon,
        value: s.progress > 0 && s.progress < 1 ? s.sunset ?? '—' : s.sunrise ?? '—',
        qualifier: s.progress > 0 && s.progress < 1 ? 'Sunset' : 'Sunrise',
        text: `${s.note}.${s.daylightMinutes != null ? ` ${formatDuration(s.daylightMinutes)} of daylight today.` : ''}`,
        visual: s.sunrise && s.sunset ? <div className="metric-sun"><SunArc progress={s.progress} sunrise={s.sunrise} sunset={s.sunset} /></div> : undefined,
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
                  </tr>
                </thead>
                <tbody>
                  {f.daily.slice(todayIdx).map((d, k) => {
                    const info = sunInfo(f, nowLocal, fmt, todayIdx + k);
                    return (
                      <tr key={d.date}>
                        <th scope="row">{dayLabel(f, todayIdx + k, nowLocal)} <span className="muted">{formatShortDate(d.date)}</span></th>
                        <td className="num">{info.sunrise ?? '—'}</td>
                        <td className="num">{info.sunset ?? '—'}</td>
                        <td className="num">{info.daylightMinutes != null ? formatDuration(info.daylightMinutes) : '—'}</td>
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
      return {
        title, icon,
        value: p.text,
        unit: p.unit,
        qualifier: c.pressureTrend[0].toUpperCase() + c.pressureTrend.slice(1),
        text: `${meaning} Sea-level pressure; the usual range is about 980 to 1040 hPa.`,
        visual: <PressureGauge hpa={c.pressureHpa} size={170} />,
        chart: chart('pressure'),
      };
    }
    case 'visibility': {
      const d = c.visibilityKm != null ? fmt.distance(c.visibilityKm) : null;
      return {
        title, icon,
        value: d ? d.text : '—',
        unit: d?.unit,
        qualifier: c.visibilityKm != null ? visibilityLabel(c.visibilityKm).replace(/\.$/, '') : 'Not available',
        text: 'How far you can clearly see. Fog, heavy rain, snow and haze bring it down.',
        chart: chart('visibility'),
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
