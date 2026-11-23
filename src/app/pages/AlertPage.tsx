import { GlassPanel, SectionHeader, WeatherIcon, cx } from '../../design-system';
import { alertAdvice } from '../../weather/insights';
import { formatShortDate, weekdayShort } from '../../weather/time';
import type { AlertSeverity } from '../../weather/types';
import { href } from '../router';
import { useApp } from '../store';
import { ForecastGate, PageHeader, usePlaceForecast } from './common';

export const SEVERITY_WORD: Record<AlertSeverity, string> = { minor: 'Advisory', moderate: 'Warning', severe: 'Severe warning' };

export function AlertPage({ placeId }: { placeId: string }) {
  const pf = usePlaceForecast(placeId);
  const { fmt } = useApp();

  return (
    <div className="detail">
      <PageHeader
        title="Weather warnings"
        subtitle={pf.place ? `${pf.place.name}${pf.forecast ? ` · ${fmt.clock(pf.nowLocal)} local time` : ''}` : undefined}
        back={pf.place ? { href: href.today(pf.place.id), label: pf.place.name } : undefined}
      />
      <ForecastGate pf={pf}>
        {(f, _nowLocal, place) =>
          f.alerts.length ? (
            f.alerts.map((a, i) => {
              const icon = /aurora/i.test(a.title) ? 'aurora' : 'alert';
              return (
                <article key={i} className="alert-detail">
                  <GlassPanel padding="xl" className={cx('alert-hero', `alert-${a.severity}`)}>
                    <span className={cx('severity-chip', `severity-${a.severity}`)}>
                      <WeatherIcon condition={icon} size={16} strokeWidth={2} tinted={false} />
                      {SEVERITY_WORD[a.severity]}
                    </span>
                    <h2 className="alert-title">{a.title}</h2>
                    {a.ends ? (
                      <p className="alert-valid">
                        Until {weekdayShort(a.ends)} {formatShortDate(a.ends)}, {fmt.clock(a.ends)}
                      </p>
                    ) : null}
                  </GlassPanel>

                  <GlassPanel aria-labelledby={`todo-${i}`}>
                    <SectionHeader id={`todo-${i}`} title="What to do" />
                    <ul className="todo-list">
                      {alertAdvice(a.title).map((t) => (
                        <li key={t}>
                          <WeatherIcon condition="check" size={16} strokeWidth={2.2} tinted={false} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </GlassPanel>

                  <GlassPanel aria-labelledby={`about-${i}`}>
                    <SectionHeader id={`about-${i}`} title="Details" />
                    <p className="alert-text">{a.description}</p>
                    <p className="detail-note">
                      Issued for {place.name} via {f.source.name}. Advice above is general; follow your local weather service.
                    </p>
                  </GlassPanel>
                </article>
              );
            })
          ) : (
            <GlassPanel className="empty-panel">
              <WeatherIcon condition="check" size={28} tinted={false} />
              <p className="empty-text">No weather warnings for {place.name} right now.</p>
              <p className="detail-note">
                {f.source.name === 'Open-Meteo'
                  ? 'Open-Meteo does not publish official warnings, so check your national weather service before severe weather.'
                  : `Warnings come from ${f.source.name}.`}
              </p>
              <a className="nb-text-btn" href={href.today(place.id)}>Back to {place.name}</a>
            </GlassPanel>
          )
        }
      </ForecastGate>
    </div>
  );
}
