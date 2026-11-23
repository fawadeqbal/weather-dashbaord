import { useEffect, useRef } from 'react';
import {
  AlertBanner,
  AnimatedNumber,
  DailyForecast,
  GlassPanel,
  HourStrip,
  RangeMeter,
  SectionHeader,
  StatTile,
  WeatherIcon,
  WindCompass,
  formatTemp,
} from '../../design-system';
import type { Format } from '../../weather/format';
import { dayIndexOf, dayLabel, nextHours, sunInfo, todayRange } from '../../weather/selectors';
import { summarize } from '../../weather/summary';
import { formatShortDate, weekdayLong } from '../../weather/time';
import type { Forecast, Place } from '../../weather/types';
import { aqiLabel, compassPoint, compassWords, feelsLikeNote, uvLabel } from '../../weather/units';
import { href, navigate } from '../router';
import { useApp } from '../store';
import { ForecastGate, usePlaceForecast } from './common';

export function TodayPage({ placeId }: { placeId?: string }) {
  const { places, setSelectedId, fmt } = useApp();
  const pf = usePlaceForecast(placeId);
  const place = pf.place;

  useEffect(() => {
    if (place) setSelectedId(place.id);
  }, [place, setSelectedId]);

  const index = place ? places.findIndex((p) => p.id === place.id) : -1;
  const prev = index > 0 ? places[index - 1] : undefined;
  const next = index >= 0 && index < places.length - 1 ? places[index + 1] : undefined;

  // Swipe left/right on the page header and hero to change city.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipeHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = swipe.current;
      swipe.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
        const target = dx < 0 ? next : prev;
        if (target) navigate(href.today(target.id));
      }
    },
  };

  return (
    <div className="today">
      <div className="place-head" {...swipeHandlers}>
        <CityArrow place={prev} dir="prev" />
        <div className="place-head-text">
          <p className="place-dateline">{pf.forecast ? `${weekdayLong(pf.nowLocal)}, ${formatShortDate(pf.nowLocal)} · ${fmt.clock(pf.nowLocal)} local time` : '\u00a0'}</p>
          <h1 id="page-title" className="page-title" tabIndex={-1}>
            {place?.name ?? 'Weather'}
            {place?.country ? <span className="page-title-sub">{place.country}</span> : null}
          </h1>
          {places.length > 1 ? (
            <div className="pager" aria-label={`City ${index + 1} of ${places.length}`} role="img">
              {places.map((p) => (
                <span key={p.id} className={p.id === place?.id ? 'pager-dot pager-dot-on' : 'pager-dot'} />
              ))}
            </div>
          ) : null}
        </div>
        <CityArrow place={next} dir="next" />
      </div>

      <ForecastGate pf={pf}>{(f, nowLocal, p) => <TodayBody f={f} nowLocal={nowLocal} place={p} swipeHandlers={swipeHandlers} />}</ForecastGate>
    </div>
  );
}

function CityArrow({ place, dir }: { place?: Place; dir: 'prev' | 'next' }) {
  if (!place) return <span className="city-arrow city-arrow-empty" aria-hidden />;
  return (
    <a className="city-arrow nb-icon-btn" href={href.today(place.id)} aria-label={`${dir === 'prev' ? 'Previous' : 'Next'} city: ${place.name}`}>
      <WeatherIcon condition={dir === 'prev' ? 'chevron-left' : 'chevron-right'} size={20} strokeWidth={2} tinted={false} />
    </a>
  );
}

function TodayBody({ f, nowLocal, place, swipeHandlers }: { f: Forecast; nowLocal: string; place: Place; swipeHandlers: Record<string, (e: React.PointerEvent) => void> }) {
  const { fmt } = useApp();
  const range = todayRange(f, nowLocal);
  const hours = nextHours(f, nowLocal, 25);
  const firstDay = dayIndexOf(f, nowLocal);
  const days = f.daily.slice(firstDay).map((d, k) => ({
    day: dayLabel(f, firstDay + k, nowLocal),
    condition: d.condition,
    conditionLabel: d.conditionLabel,
    pop: d.precipProbability,
    low: fmt.tempValue(d.minC),
    high: fmt.tempValue(d.maxC),
    href: href.day(place.id, firstDay + k),
  }));
  const alert = f.alerts[0];

  return (
    <>
      {alert ? (
        <AlertBanner title={alert.title} icon={/aurora/i.test(alert.title) ? 'aurora' : 'alert'}>
          {alert.description}
        </AlertBanner>
      ) : null}

      <div className="today-grid">
        <GlassPanel padding="xl" className="hero" aria-label="Current conditions" {...swipeHandlers}>
          <div className="hero-main">
            <span className="hero-temp">
              <AnimatedNumber value={fmt.tempValue(f.current.tempC)} format={formatTemp} />
            </span>
            <p className="hero-cond">
              <WeatherIcon condition={f.current.condition} size={26} />
              {f.current.conditionLabel}
            </p>
            <p className="hero-hilo">
              H {fmt.temp(range.maxC)} · L {fmt.temp(range.minC)} · Feels like {fmt.temp(f.current.feelsLikeC)}
            </p>
            <p className="hero-summary">{summarize(f, fmt, nowLocal)}</p>
          </div>
          <div className="hero-art" aria-hidden>
            <WeatherIcon condition={f.current.condition} size={140} strokeWidth={0.9} />
          </div>
        </GlassPanel>

        <GlassPanel className="today-hourly" aria-labelledby="hourly-h">
          <SectionHeader id="hourly-h" title="Next 24 hours" action={{ href: href.hourly(place.id), label: 'Hourly details' }} />
          <HourStrip
            hours={hours.map((h, i) => ({
              key: h.time,
              label: i === 0 ? 'Now' : fmt.clock(h.time, true),
              condition: h.condition,
              conditionLabel: h.conditionLabel,
              temp: fmt.temp(i === 0 ? f.current.tempC : h.tempC),
              pop: h.precipProbability,
              now: i === 0,
            }))}
          />
        </GlassPanel>

        <div className="today-daily">
          <DailyForecast days={days} title={`${days.length}-day forecast`} />
        </div>
      </div>

      <section className="today-stats" aria-labelledby="now-h">
        <SectionHeader id="now-h" title="Right now" />
        <div className="stat-grid">
          <StatTiles f={f} nowLocal={nowLocal} place={place} fmt={fmt} />
        </div>
      </section>
    </>
  );
}

function StatTiles({ f, nowLocal, place, fmt }: { f: Forecast; nowLocal: string; place: Place; fmt: Format }) {
  const c = f.current;
  const today = f.daily[dayIndexOf(f, nowLocal)];
  const wind = fmt.wind(c.windKmh);
  const pres = fmt.pressure(c.pressureHpa);
  const sun = sunInfo(f, nowLocal, fmt);
  const m = (key: Parameters<typeof href.metric>[1]) => href.metric(place.id, key);
  const precipAmount = today?.precipSumMm != null ? fmt.precip(today.precipSumMm) : null;

  return (
    <>
      <StatTile href={m('feels')} label="Feels like" icon="thermometer" value={fmt.temp(c.feelsLikeC)} caption={feelsLikeNote(c.tempC, c.feelsLikeC)} />
      <StatTile href={m('wind')} label="Wind" icon="wind" value={wind.text} unit={wind.unit} caption={`From ${compassPoint(c.windDirectionDeg)} · gusts ${fmt.windText(c.windGustKmh)}`}>
        <span className="stat-compass">
          <WindCompass degrees={c.windDirectionDeg} size={56} label={`Wind ${compassWords(c.windDirectionDeg)}`} />
        </span>
      </StatTile>
      <StatTile
        href={m('precip')}
        label="Precipitation"
        icon="umbrella"
        value={today?.precipProbability != null ? `${today.precipProbability}%` : '—'}
        caption={precipAmount ? (precipAmount.value > 0 ? `${precipAmount.text} ${precipAmount.unit} expected today` : 'None expected today') : 'Chance today'}
      />
      <StatTile href={m('uv')} label="UV index" icon="sun" value={c.uvIndex != null ? Math.round(c.uvIndex) : '—'} caption={c.uvIndex != null ? uvLabel(c.uvIndex) : 'Not available'}>
        {c.uvIndex != null ? <RangeMeter scale="uv" value={c.uvIndex} label={`UV index ${Math.round(c.uvIndex)}`} /> : null}
      </StatTile>
      <StatTile href={m('humidity')} label="Humidity" icon="humidity" value={`${Math.round(c.humidity)}%`} caption={`Dew point ${fmt.temp(c.dewPointC)}`}>
        <RangeMeter value={c.humidity} label={`Humidity ${Math.round(c.humidity)}%`} />
      </StatTile>
      <StatTile href={m('air')} label="Air quality" icon="air-quality" value={c.aqi != null ? Math.round(c.aqi) : '—'} caption={c.aqi != null ? aqiLabel(c.aqi) : 'Not available'}>
        {c.aqi != null ? <RangeMeter scale="aqi" value={c.aqi} label={`Air quality index ${Math.round(c.aqi)}`} /> : null}
      </StatTile>
      <StatTile href={m('sun')} label="Sun" icon="sunrise" value={sun.progress > 0 && sun.progress < 1 ? sun.sunset ?? '—' : sun.sunrise ?? '—'} caption={sun.note} />
      <StatTile href={m('pressure')} label="Pressure" icon="pressure" value={pres.text} unit={pres.unit} caption={c.pressureTrend[0].toUpperCase() + c.pressureTrend.slice(1)} />
    </>
  );
}
