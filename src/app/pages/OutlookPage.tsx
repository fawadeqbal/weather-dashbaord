import { DailyForecast, GlassPanel, type DayForecast } from '../../design-system';
import type { Format } from '../../weather/format';
import { useOutlook } from '../../weather/hooks';
import { dayIndexOf } from '../../weather/selectors';
import { formatShortDate, weekdayShort } from '../../weather/time';
import type { DailyWeather, Forecast } from '../../weather/types';
import { href } from '../router';
import { useApp } from '../store';
import { ForecastGate, PageHeader, usePlaceForecast } from './common';

export function OutlookPage({ placeId }: { placeId: string }) {
  const pf = usePlaceForecast(placeId);
  const { fmt, provider } = useApp();
  const outlook = useOutlook(provider, pf.place);

  return (
    <div className="detail">
      <PageHeader
        title="16-day outlook"
        subtitle={pf.place ? `${pf.place.name}${pf.forecast ? ` · ${fmt.clock(pf.nowLocal)} local time` : ''}` : undefined}
        back={pf.place ? { href: href.today(pf.place.id), label: pf.place.name } : undefined}
      />
      <ForecastGate pf={pf}>
        {(f, nowLocal) => {
          const today = nowLocal.slice(0, 10);
          const long = outlook.status === 'ready' ? outlook.days : null;
          const all = (long ?? f.daily).filter((d) => d.date >= today);
          const near = all.slice(0, 7);
          const far = all.slice(7);
          const scale = { low: Math.min(...all.map((d) => fmt.tempValue(d.minC))), high: Math.max(...all.map((d) => fmt.tempValue(d.maxC))) };
          const rows = (list: DailyWeather[]) => list.map((d) => toRow(d, f, nowLocal, fmt));

          return (
            <>
              <GlassPanel padding="xl" className="outlook-hero">
                <p className="outlook-summary">{outlookSummary(all, fmt)}</p>
                {outlook.status === 'loading' ? <p className="detail-note" role="status">Loading days 8 to 16…</p> : null}
                {outlook.status === 'error' ? (
                  <p className="detail-note" role="alert">
                    Days 8 to 16 did not load. {outlook.error}{' '}
                    <button type="button" className="link-btn" onClick={outlook.retry}>Try again</button>
                  </p>
                ) : null}
                {outlook.status === 'unsupported' ? <p className="detail-note">This weather source only forecasts {all.length} days ahead.</p> : null}
              </GlassPanel>

              <DailyForecast days={rows(near)} title="Next 7 days" scale={scale} />
              {far.length ? (
                <DailyForecast
                  days={rows(far)}
                  title={`Days 8 to ${7 + far.length}`}
                  note="Lower confidence: good for spotting trends, not for exact plans."
                  scale={scale}
                />
              ) : null}
              <p className="detail-hint">Every bar uses the same scale, from {fmt.temp(fromDisplay(scale.low, fmt))} to {fmt.temp(fromDisplay(scale.high, fmt))}, so you can compare days at a glance.</p>
            </>
          );
        }}
      </ForecastGate>
    </div>
  );
}

/** Undo fmt.tempValue so the hint can reuse fmt.temp. */
const fromDisplay = (v: number, fmt: Format) => (fmt.prefs.temp === 'F' ? ((v - 32) * 5) / 9 : v);

function toRow(d: DailyWeather, f: Forecast, nowLocal: string, fmt: Format): DayForecast {
  const today = nowLocal.slice(0, 10);
  const idx = f.daily.findIndex((x) => x.date === d.date);
  const first = dayIndexOf(f, nowLocal);
  const label = d.date === today ? 'Today' : idx === first + 1 ? 'Tomorrow' : weekdayShort(d.date);
  return {
    day: label,
    sub: formatShortDate(d.date),
    condition: d.condition,
    conditionLabel: d.conditionLabel,
    pop: d.precipProbability,
    low: fmt.tempValue(d.minC),
    high: fmt.tempValue(d.maxC),
    // Only days the main forecast covers have an hour-by-hour page.
    href: idx >= 0 ? href.day(f.place.id, idx) : undefined,
  };
}

export function outlookSummary(days: DailyWeather[], fmt: Format): string {
  if (!days.length) return 'No outlook available.';
  const warm = days.reduce((a, b) => (b.maxC > a.maxC ? b : a));
  const cold = days.reduce((a, b) => (b.minC < a.minC ? b : a));
  const wet = days.reduce((a, b) => ((b.precipProbability ?? 0) > (a.precipProbability ?? 0) ? b : a));
  const dry = days.filter((d) => (d.precipProbability ?? 0) < 30).length;
  const when = (d: DailyWeather) => `${weekdayShort(d.date)} ${formatShortDate(d.date)}`;
  const parts = [`Warmest ${when(warm)} at ${fmt.temp(warm.maxC)}, coldest night ${when(cold)} at ${fmt.temp(cold.minC)}.`];
  parts.push((wet.precipProbability ?? 0) >= 40 ? `Best chance of rain ${when(wet)} (${wet.precipProbability}%); ${dry} of ${days.length} days look mostly dry.` : `${dry} of ${days.length} days look mostly dry.`);
  return parts.join(' ');
}
