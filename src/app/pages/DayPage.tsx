import { GlassPanel, SectionHeader, SunArc, TrendChart, WeatherIcon, cx } from '../../design-system';
import { dayIndexOf, dayLabel, hoursOn, sunInfo } from '../../weather/selectors';
import { summarizeDay } from '../../weather/summary';
import { formatDuration, formatShortDate } from '../../weather/time';
import { uvLabel } from '../../weather/units';
import { href } from '../router';
import { pointsFor } from '../series';
import { useApp } from '../store';
import { Fact, ForecastGate, PageHeader, usePlaceForecast } from './common';

export function DayPage({ placeId, index }: { placeId: string; index: number }) {
  const pf = usePlaceForecast(placeId);
  const { fmt } = useApp();

  return (
    <div className="detail">
      <ForecastGate pf={pf}>
        {(f, nowLocal, place) => {
          const first = dayIndexOf(f, nowLocal);
          const i = Math.min(Math.max(index, first), f.daily.length - 1);
          const day = f.daily[i];
          const isToday = i === first;
          const hours = hoursOn(f, day.date);
          const visible = isToday ? hours.filter((h) => h.time.slice(0, 13) >= nowLocal.slice(0, 13)) : hours;
          const sun = sunInfo(f, nowLocal, fmt, i);
          const precip = day.precipSumMm != null ? fmt.precip(day.precipSumMm) : null;
          const prev = i > first ? i - 1 : null;
          const next = i < f.daily.length - 1 ? i + 1 : null;

          return (
            <>
              <PageHeader
                title={`${dayLabel(f, i, nowLocal, true)}, ${formatShortDate(day.date)}`}
                subtitle={place.name}
                back={{ href: href.today(place.id), label: place.name }}
              />

              <nav className="day-chips" aria-label="Choose a day">
                {f.daily.slice(first).map((d, k) => {
                  const di = first + k;
                  return (
                    <a key={d.date} href={href.day(place.id, di)} className={cx('day-chip', di === i && 'day-chip-on')} aria-current={di === i ? 'page' : undefined}>
                      <span className="day-chip-name">{dayLabel(f, di, nowLocal)}</span>
                      <WeatherIcon condition={d.condition} size={20} />
                      <span className="day-chip-temps">
                        {fmt.temp(d.maxC)} <span>{fmt.temp(d.minC)}</span>
                      </span>
                    </a>
                  );
                })}
              </nav>

              <GlassPanel padding="xl" className="day-hero">
                <WeatherIcon condition={day.condition} size={72} strokeWidth={1.1} />
                <div className="day-hero-text">
                  <p className="hero-cond">{day.conditionLabel}</p>
                  <p className="day-hero-temps">
                    <span className="day-hi">{fmt.temp(day.maxC)}</span>
                    <span className="day-lo">{fmt.temp(day.minC)}</span>
                  </p>
                  <p className="hero-summary">{summarizeDay(hours, fmt)}</p>
                </div>
              </GlassPanel>

              <div className="fact-grid fact-grid-3">
                <Fact icon="umbrella" label="Precipitation" value={day.precipProbability != null ? `${day.precipProbability}%` : '—'} note={precipNote(precip)} />
                <Fact icon="wind" label="Max wind" value={day.windMaxKmh != null ? fmt.windText(day.windMaxKmh) : '—'} note="Sustained, at 10 m" />
                <Fact icon="sun" label="UV index max" value={day.uvIndexMax != null ? String(Math.round(day.uvIndexMax)) : '—'} note={day.uvIndexMax != null ? uvLabel(day.uvIndexMax) : 'Not available'} />
                <Fact icon="sunrise" label="Daylight" value={sun.daylightMinutes != null ? formatDuration(sun.daylightMinutes) : '—'} note={sun.sunrise && sun.sunset ? `${sun.sunrise} – ${sun.sunset}` : sun.note} />
                <Fact icon="sun" label="Sunshine" value={day.sunshineSec != null ? formatDuration(day.sunshineSec / 60) : '—'} note={day.sunshineSec != null && sun.daylightMinutes ? `${Math.round((day.sunshineSec / 60 / sun.daylightMinutes) * 100)}% of daylight` : 'Not available'} />
                <Fact icon="umbrella" label="Wet hours" value={day.precipHours != null ? `${day.precipHours} h` : '—'} note={day.precipHours ? 'Hours with rain or snow' : day.precipHours === 0 ? 'Dry all day' : 'Not available'} />
              </div>

              {visible.length > 1 ? (
                <GlassPanel aria-labelledby="day-temp-h" className="detail-chart">
                  <SectionHeader id="day-temp-h" title={isToday ? 'Temperature for the rest of today' : 'Temperature through the day'} />
                  <div className="detail-chart-scroll">
                    <div style={{ minWidth: visible.length * 30 }}>
                      <TrendChart label="Temperature by hour" points={pointsFor('temp', visible, fmt, isToday)} labelEvery={3} showValues={false} height={180} />
                    </div>
                  </div>
                </GlassPanel>
              ) : null}

              {visible.length > 1 ? (
                <GlassPanel aria-labelledby="day-rain-h" className="detail-chart">
                  <SectionHeader id="day-rain-h" title="Chance of precipitation" />
                  {visible.every((h) => (h.precipProbability ?? 0) < 5) ? (
                    <p className="detail-note">No rain or snow expected{isToday ? ' for the rest of today' : ''}.</p>
                  ) : (
                  <div className="detail-chart-scroll">
                    <div style={{ minWidth: visible.length * 30 }}>
                      <TrendChart label="Chance of precipitation by hour" kind="bar" min={0} max={100} points={pointsFor('precip', visible, fmt, isToday)} labelEvery={3} showValues={false} height={130} />
                    </div>
                  </div>
                  )}
                </GlassPanel>
              ) : null}

              {isToday && sun.sunrise && sun.sunset ? (
                <GlassPanel aria-labelledby="day-sun-h" className="day-sun">
                  <SectionHeader id="day-sun-h" title="Sunrise and sunset" />
                  <SunArc progress={sun.progress} sunrise={sun.sunrise} sunset={sun.sunset} />
                  <p className="detail-note">{sun.note}</p>
                </GlassPanel>
              ) : null}

              <div className="day-pager">
                {prev != null ? (
                  <a className="nb-text-btn" href={href.day(place.id, prev)}>
                    <WeatherIcon condition="chevron-left" size={16} strokeWidth={2} tinted={false} />
                    {dayLabel(f, prev, nowLocal, true)}
                  </a>
                ) : (
                  <span />
                )}
                {next != null ? (
                  <a className="nb-text-btn" href={href.day(place.id, next)}>
                    {dayLabel(f, next, nowLocal, true)}
                    <WeatherIcon condition="chevron-right" size={16} strokeWidth={2} tinted={false} />
                  </a>
                ) : null}
              </div>
            </>
          );
        }}
      </ForecastGate>
    </div>
  );
}

function precipNote(m: { value: number; text: string; unit: string } | null): string {
  if (!m) return 'Chance';
  return m.value > 0 ? `${m.text} ${m.unit} expected` : 'None expected';
}
