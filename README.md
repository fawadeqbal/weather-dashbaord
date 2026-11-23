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

## What it does

- Five starter cities (San Francisco, Tokyo, Sydney, London, Reykjavík). Search adds any city through the geocoder; cities, the selected city and the °C/°F choice are saved in the browser.
- For the selected city it shows the current conditions with a generated one-line forecast, the next 24 hours, 7 days, wind, UV, humidity, sunrise and sunset, air quality and pressure.
- Each city's sky photo and colour theme follow its weather and local time: rain, storm, snow, fog, overcast, partly cloudy, sunny, sunrise, dusk, a starry night, a cloudy night, or an aurora on clear nights at high latitudes. Rain and snow fall over the photo (off under reduced motion).
- Forecasts refresh every 15 minutes, and when you come back to the tab after that long. If a refresh fails, the last forecast stays on screen with a notice and a **Try again** button.
- The header shows the city's real local time, not your own.

## Project layout

```
src/
  design-system/        Nimbus components, tokens.css and nimbus.css
  weather/
    types.ts            The app's own weather model (provider-neutral, metric)
    providers/
      types.ts          WeatherProvider interface, WeatherProviderError, fetchJson
      openMeteo.ts      Open-Meteo adapter (forecast, air quality, geocoding)
      mock.ts           Sample data for the five starter cities
      index.ts          Provider registry and selection
      __fixtures__/     Real Open-Meteo responses used by the tests
    conditions.ts       WMO weather codes → icons/labels; weather → theme + photo
    present.ts          Forecast → exactly what the screen shows, in your units
    summary.ts          The one-line forecast sentence
    units.ts, time.ts   Unit conversion, labels, local-time helpers
    hooks.ts            useForecasts, usePlaceSearch, useStoredState
  App.tsx               The screen
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

- Return metric values (°C, km/h, km, hPa). The app converts for display.
- Give times as the place's local wall-clock time without an offset (`"2026-11-23T14:41"`), with `hourly` starting at the current hour (at least 25 entries) and `daily` starting today.
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
