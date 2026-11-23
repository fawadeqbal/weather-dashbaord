import { useState } from 'react';
import { GlassPanel, SegmentedControl, TrendChart, WeatherIcon } from '../../design-system';
import { dayLabel, nextHours } from '../../weather/selectors';
import { formatShortDate } from '../../weather/time';
import type { HourlyWeather } from '../../weather/types';
import { compassPoint } from '../../weather/units';
import { href } from '../router';
import { pointsFor, SERIES, type SeriesKey } from '../series';
import { useApp } from '../store';
import { ForecastGate, PageHeader, usePlaceForecast } from './common';

const CHOICES: SeriesKey[] = ['temp', 'feels', 'precip', 'wind', 'humidity', 'uv'];

export function HourlyPage({ placeId }: { placeId: string }) {
  const pf = usePlaceForecast(placeId);
  const { fmt } = useApp();
  const [series, setSeries] = useState<SeriesKey>('temp');
  const [span, setSpan] = useState<'24' | '48'>('24');

  return (
    <div className="detail">
      <PageHeader
        title="Hourly forecast"
        subtitle={pf.place ? `${pf.place.name}${pf.forecast ? ` · ${fmt.clock(pf.nowLocal)} local time` : ''}` : undefined}
        back={pf.place ? { href: href.today(pf.place.id), label: pf.place.name } : undefined}
      />
      <ForecastGate pf={pf}>
        {(f, nowLocal) => {
          const hours = nextHours(f, nowLocal, span === '24' ? 25 : 49);
          const groups = groupByDate(hours);
          return (
            <>
              <GlassPanel className="detail-chart" aria-label={`${SERIES[series].label}, next ${span} hours`}>
                <div className="detail-chart-controls">
                  <SegmentedControl
                    label="Show"
                    size="sm"
                    value={series}
                    onChange={setSeries}
                    options={CHOICES.map((k) => ({ value: k, label: SERIES[k].label }))}
                    className="detail-seg-wide"
                  />
                  <SegmentedControl label="Range" size="sm" value={span} onChange={setSpan} options={[{ value: '24', label: '24 h' }, { value: '48', label: '48 h' }]} />
                </div>
                <div className="detail-chart-scroll">
                  <div style={{ minWidth: hours.length * 30 }}>
                    <TrendChart
                      key={`${series}-${span}`}
                      label={`${SERIES[series].label} for the next ${span} hours`}
                      kind={SERIES[series].kind}
                      min={SERIES[series].min}
                      max={SERIES[series].max}
                      points={pointsFor(series, hours, fmt)}
                      height={200}
                      labelEvery={3}
                      showValues={false}
                    />
                  </div>
                </div>
                <p className="detail-hint">Hover, drag or use the arrow keys on the chart to read each hour.</p>
              </GlassPanel>

              <GlassPanel className="detail-table-panel" padding="md">
                <div className="detail-table-scroll">
                  <table className="hour-table">
                    <caption className="nb-sr">Hour-by-hour forecast</caption>
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Conditions</th>
                        <th scope="col">Temp</th>
                        <th scope="col">Feels</th>
                        <th scope="col">Rain</th>
                        <th scope="col">Wind</th>
                      </tr>
                    </thead>
                    {groups.map((g) => {
                      const dayIdx = f.daily.findIndex((d) => d.date === g.date);
                      return (
                        <tbody key={g.date}>
                          <tr className="hour-table-day">
                            <th scope="rowgroup" colSpan={6}>
                              <a href={href.day(f.place.id, dayIdx < 0 ? 0 : dayIdx)}>
                                {dayIdx >= 0 ? dayLabel(f, dayIdx, nowLocal, true) : ''} · {formatShortDate(g.date)}
                                <WeatherIcon condition="chevron-right" size={14} strokeWidth={2} tinted={false} />
                              </a>
                            </th>
                          </tr>
                          {g.hours.map((h) => (
                            <HourRow key={h.time} h={h} isNow={h.time === hours[0].time} />
                          ))}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
              </GlassPanel>
            </>
          );
        }}
      </ForecastGate>
    </div>
  );
}

function HourRow({ h, isNow }: { h: HourlyWeather; isNow: boolean }) {
  const { fmt } = useApp();
  return (
    <tr className={isNow ? 'hour-row-now' : undefined}>
      <th scope="row">{isNow ? 'Now' : fmt.clock(h.time, true)}</th>
      <td>
        <span className="hour-cond">
          <WeatherIcon condition={h.condition} size={20} />
          {h.conditionLabel}
        </span>
      </td>
      <td className="num strong">{fmt.temp(h.tempC)}</td>
      <td className="num">{fmt.temp(h.feelsLikeC)}</td>
      <td className="num precip">{h.precipProbability ? `${h.precipProbability}%` : '–'}</td>
      <td className="num">{h.windKmh != null ? `${fmt.windText(h.windKmh)}${h.windDirectionDeg != null ? ` ${compassPoint(h.windDirectionDeg)}` : ''}` : '–'}</td>
    </tr>
  );
}

function groupByDate(hours: HourlyWeather[]) {
  const out: { date: string; hours: HourlyWeather[] }[] = [];
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const last = out[out.length - 1];
    if (last?.date === date) last.hours.push(h);
    else out.push({ date, hours: [h] });
  }
  return out;
}
