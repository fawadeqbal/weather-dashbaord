import { GlassPanel, SectionHeader, WeatherIcon, cx } from '../../design-system';
import { INTENSITY_WORD, nextRain, nowcastSteps, nowcastSummary, type Intensity } from '../../weather/insights';
import { dayLabel } from '../../weather/selectors';
import { href } from '../router';
import { useApp } from '../store';
import { ForecastGate, PageHeader, usePlaceForecast } from './common';

/** Bar height is capped at heavy rain (8 mm/h) so light rain still shows. */
const CAP_MM_H = 8;

export function NowcastPage({ placeId }: { placeId: string }) {
  const pf = usePlaceForecast(placeId);
  const { fmt } = useApp();

  return (
    <div className="detail">
      <PageHeader
        title="Next 2 hours"
        subtitle={pf.place ? `${pf.place.name}${pf.forecast ? ` · ${fmt.clock(pf.nowLocal)} local time` : ''}` : undefined}
        back={pf.place ? { href: href.today(pf.place.id), label: pf.place.name } : undefined}
      />
      <ForecastGate pf={pf}>
        {(f, nowLocal, place) => {
          const { steps, resolution } = nowcastSteps(f, nowLocal);
          const snow = f.current.condition === 'snow';
          const noun = snow ? 'snow' : 'rain';
          const summary = nowcastSummary(steps, fmt, noun);
          const later = nextRain(f, nowLocal);
          const dryAll = steps.every((s) => s.intensity === 'none');
          const laterDay = later.time ? f.daily.findIndex((d) => d.date === later.time!.slice(0, 10)) : -1;

          return (
            <>
              <GlassPanel padding="xl" className="nowcast-hero">
                <WeatherIcon condition={dryAll ? (f.current.isDay ? 'sun' : 'moon') : snow ? 'snow' : 'rain'} size={44} strokeWidth={1.3} />
                <p className="outlook-summary" role="status">{summary}</p>
              </GlassPanel>

              <GlassPanel aria-labelledby="nowcast-h">
                <SectionHeader id="nowcast-h" title={resolution === 15 ? 'Every 15 minutes' : 'Hour by hour'} />
                <ol className="nowcast-bars" aria-label={`${noun} intensity by time`}>
                  {steps.map((s, i) => (
                    <li key={s.time} className={cx('nowcast-step', `nowcast-${s.intensity}`)}>
                      <span className="nowcast-bar" aria-hidden>
                        <span style={{ height: `${s.intensity === 'none' ? 0 : Math.max(8, Math.min(s.rateMmH / CAP_MM_H, 1) * 100)}%` }} />
                      </span>
                      <span className={cx('nowcast-time', resolution === 15 && i % 2 === 1 && 'nowcast-time-minor')}>{i === 0 ? 'Now' : fmt.clock(s.time)}</span>
                      <span className="nb-sr">{`${INTENSITY_WORD[s.intensity]}${s.intensity !== 'none' ? ` ${noun}` : ''}`}</span>
                    </li>
                  ))}
                </ol>
                <IntensityKey />
                {resolution === 60 ? <p className="detail-note">15-minute data isn’t available here, so this shows hourly amounts.</p> : null}
              </GlassPanel>

              {dryAll ? (
                <GlassPanel padding="md" className="nowcast-later">
                  <WeatherIcon condition="umbrella" size={20} strokeWidth={1.8} tinted={false} />
                  <p>
                    {later.time ? (
                      <>
                        Next {noun} likely {laterDay >= 0 ? onDay(dayLabel(f, laterDay, nowLocal, true)) : ''} around {fmt.clock(later.time, true)}
                        {later.hour?.precipProbability != null ? ` (${later.hour.precipProbability}% chance)` : ''}.{' '}
                        {laterDay >= 0 ? <a href={href.day(place.id, laterDay)}>See that day</a> : null}
                      </>
                    ) : (
                      'No rain or snow in the forecast this week.'
                    )}
                  </p>
                </GlassPanel>
              ) : null}
            </>
          );
        }}
      </ForecastGate>
    </div>
  );
}

/** "Today" → "today", "Wednesday" → "on Wednesday". */
const onDay = (label: string) => (label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : `on ${label}`);

function IntensityKey() {
  const items: Intensity[] = ['light', 'moderate', 'heavy'];
  return (
    <ul className="intensity-key" aria-label="Intensity key">
      {items.map((k) => (
        <li key={k}>
          <span className={cx('intensity-swatch', `nowcast-${k}`)} aria-hidden />
          {INTENSITY_WORD[k]}
          <span className="muted">{k === 'light' ? ' under 2.5 mm/h' : k === 'moderate' ? ' 2.5–7.6 mm/h' : ' over 7.6 mm/h'}</span>
        </li>
      ))}
    </ul>
  );
}
