# Nimbus Weather

A weather dashboard that shows each city under its own real sky: a photo that matches the weather, frosted-glass panels for the data, and live forecasts from [Open-Meteo](https://open-meteo.com/) (free, no API key).

Built with React 18, TypeScript and Vite on the **Nimbus design system** (`src/design-system`).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run build      # type-check and production build into dist/
```

Open `http://localhost:5173/?provider=mock` to use the built-in sample data instead of the live API (works offline).

## Screens

Every screen has its own address (hash routes, so they work on GitHub Pages), and Back, refresh and sharing a link all work.

| Screen | Address | What it shows |
|---|---|---|
| Today | `#/` or `#/p/<city>` | Current conditions with a one-line forecast, the next 24 hours, the 7-day forecast and eight "Right now" tiles. Arrows, pager dots or a swipe move between saved cities. |
| Hourly | `#/p/<city>/hourly` | An interactive chart (temperature, feels like, precipitation, wind, humidity, UV) for 24 or 48 hours, and an hour-by-hour table grouped by day. |
| Day | `#/p/<city>/day/<n>` | One day: conditions, high and low, a summary, precipitation, wind, UV, daylight, and hourly temperature and rain charts. Day chips switch days. |
| Metric | `#/p/<city>/metric/<name>` | Feels like, wind, precipitation, UV, humidity, air quality, sun, pressure or visibility: the value, what it means, a 24-hour chart and extras such as the AQI scale or a week of sunrise times. |
| Locations | `#/locations` | Saved cities with their live sky. Search to add, use your current location, and **Edit** to reorder (drag, arrow keys or buttons) or remove with **Undo**. |
| Settings | `#/settings` | Units for temperature, wind, pressure, distance, precipitation and the clock (with Metric/Imperial presets), data source, refresh, reset. |

Micro-interactions: page transitions, the hero temperature counts to its new value, charts you can hover, drag or read with the arrow keys, tiles that lift on hover and press in, a sliding selection pill on toggles, toasts with Undo, photos that crossfade between weathers, and rain or snow falling over the photo. All motion stops under reduced motion.

Forecasts refresh every 15 minutes and when you come back to the tab after that long. Brief network or server errors are retried automatically; if a refresh still fails, the last forecast stays on screen with a **Try again** button.

## Project layout

```
src/
  App.tsx               Provider + shell
  app/
    router.ts           Hash routes and link builders
    store.tsx           Saved cities, unit preferences, forecasts, toasts
    Shell.tsx           Sky, header, navigation, page transitions
    series.ts           Chartable hourly series shared by the detail pages
    pages/              Today, Hourly, Day, Metric, Locations, Settings
  design-system/        Nimbus components, tokens.css and nimbus.css
  weather/
    types.ts            The app's own weather model (provider-neutral, metric)
    format.ts           Unit preferences and every display format
    selectors.ts        What each screen picks out of a forecast
    summary.ts          The forecast sentences
    conditions.ts       WMO weather codes → icons/labels; weather → theme + photo
    units.ts, time.ts   Words for values (UV, AQI, wind force…), local-time helpers
    hooks.ts            useForecasts, usePlaceSearch, useStoredState
    providers/
      types.ts          WeatherProvider interface, errors, fetchJson with retries
      openMeteo.ts      Open-Meteo adapter (forecast, air quality, geocoding)
      mock.ts           Seven days of sample data for the five starter cities
      index.ts          Provider registry and selection
      __fixtures__/     Real Open-Meteo responses used by the tests
public/skies/           Sky photos (Unsplash licence)
```

## The weather API layer

The UI only ever sees the types in `src/weather/types.ts`. A **provider** turns one weather API into those types:

```ts
interface WeatherProvider {
  id: string;     // "open-meteo"
  name: string;   // shown in the attribution line
  getForecast(place: Place, options?: { signal?: AbortSignal }): Promise<Forecast>;
  searchPlaces(query: string, options?: { signal?: AbortSignal }): Promise<Place[]>;
}
```

Rules every provider follows:

- Return metric values (°C, km/h, km, hPa, mm). The app converts for display.
- Give times as the place's local wall-clock time without an offset (`"2026-11-23T14:41"`). `hourly` covers every day in `daily`, starting at 00:00 today, with temperature, feels like, precipitation, wind, humidity, pressure, UV and visibility where the API has them (`null` otherwise); `daily` starts today.
- Map conditions to the Nimbus icons (`sun`, `moon`, `partly`, `cloud`, `rain`, `snow`, `storm`). If the API uses WMO codes, reuse `fromWmoCode()`.
- Put weather warnings in `alerts` if the API has them (Open-Meteo does not, so the list is empty there). The first alert shows as a banner.
- Fail with `WeatherProviderError` (use `fetchJson()` for HTTP), and pass `signal` to `fetch` so switching cities cancels stale requests.

### Choose the provider

Copy `.env.example` to `.env`:

```bash
VITE_WEATHER_PROVIDER=open-meteo   # or: mock
```

A `?provider=` URL parameter overrides it for one visit.

### Add another weather API

1. Create `src/weather/providers/<name>.ts` that exports `create<Name>Provider(): WeatherProvider`. Keep the mapping in a pure function (like `mapOpenMeteo`) so it can be tested with saved responses.
2. Register it in `PROVIDERS` in `src/weather/providers/index.ts`.
3. Save a real response under `providers/__fixtures__/` and add a test next to `openMeteo.test.ts`.
4. Set `VITE_WEATHER_PROVIDER=<name>`.

### API keys

Open-Meteo needs no key. For an API that does, `VITE_WEATHER_API_KEY` is read through `import.meta.env`. Anything prefixed `VITE_` is bundled into the browser JavaScript and visible to every visitor. For production, call that API from a small server or edge function that holds the key, and point the provider at your endpoint instead.

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
- Sky photos: [Unsplash](https://unsplash.com/license), free to use under the Unsplash licence.
- Icons adapted from [Lucide](https://lucide.dev/) (ISC licence).
