import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import PlaceSearch from "@/components/PlaceSearch";
import {
  getWeatherForCoords,
  getWeatherForQuery,
} from "@/lib/weather.functions";

const LiveMap = lazy(() => import("@/components/LiveMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atlas Climate — Live Weather Station & Google Map" },
      {
        name: "description",
        content:
          "Live conditions, hourly forecast, and air quality for any city, plotted on an interactive Google map.",
      },
      { property: "og:title", content: "Atlas Climate — Live Weather Station" },
      {
        property: "og:description",
        content:
          "Search any city and watch live weather, air quality, and forecast update on an interactive map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FAVORITES = ["New York", "Tokyo", "London", "Reykjavik", "Sydney", "Cairo"];

type Target =
  | { kind: "query"; query: string }
  | { kind: "coords"; name: string; lat: number; lng: number };

function Index() {
  const [target, setTarget] = useState<Target>({
    kind: "query",
    query: "New York",
  });
  const byQuery = useServerFn(getWeatherForQuery);
  const byCoords = useServerFn(getWeatherForCoords);

  const { data, isPending, error } = useQuery({
    queryKey: ["weather", target],
    queryFn: () =>
      target.kind === "query"
        ? byQuery({ data: { query: target.query } })
        : byCoords({
            data: { name: target.name, lat: target.lat, lng: target.lng },
          }),
    staleTime: 5 * 60 * 1000,
  });

  const activeLabel =
    target.kind === "query" ? target.query : target.name;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Atlas Climate
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Live weather station
            </h1>
          </div>
          <PlaceSearch
            onSelect={(query) => setTarget({ kind: "query", query })}
          />
        </header>

        <nav className="mt-6 flex flex-wrap gap-2">
          {FAVORITES.map((city) => (
            <button
              key={city}
              onClick={() => setTarget({ kind: "query", query: city })}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                activeLabel === city
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {city}
            </button>
          ))}
        </nav>

        {error && (
          <p className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <article className="rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-glow)]">
            <p className="text-sm text-muted-foreground">
              {isPending ? "Loading…" : data?.place.name}
            </p>
            <div className="mt-4 flex items-end gap-4">
              <span className="text-7xl font-semibold leading-none tracking-tighter">
                {data ? `${data.current.temp}°` : "—"}
              </span>
              <div className="pb-2">
                <p className="text-lg">{data?.current.condition ?? ""}</p>
                <p className="text-sm text-muted-foreground">
                  {data ? `Feels like ${data.current.feelsLike}°C` : ""}
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Humidity" value={data && `${data.current.humidity}%`} />
              <Metric
                label="Wind"
                value={data && `${data.current.windSpeed} km/h`}
                hint={data ? `${data.current.windDirection}°` : undefined}
              />
              <Metric label="UV index" value={data?.current.uvIndex ?? undefined} />
              <Metric
                label="Pressure"
                value={data?.current.pressure && `${data.current.pressure} hPa`}
              />
              <Metric
                label="Visibility"
                value={
                  data?.current.visibility && `${data.current.visibility} km`
                }
              />
              <Metric
                label="Air quality"
                value={data?.airQuality?.aqi}
                hint={data?.airQuality?.category}
              />
            </div>
          </article>

          <article className="min-h-[380px] overflow-hidden rounded-3xl border border-border bg-card p-2">
            <ClientOnly fallback={<MapSkeleton />}>
              <Suspense fallback={<MapSkeleton />}>
                <LiveMap
                  lat={data?.place.lat ?? 40.7128}
                  lng={data?.place.lng ?? -74.006}
                  label={data?.place.name ?? "New York"}
                  onPick={(p) => setTarget({ kind: "coords", ...p })}
                />
              </Suspense>
            </ClientOnly>
          </article>
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-7">
          <h2 className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Next 12 hours
          </h2>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {(data?.hourly ?? []).map((h) => (
              <div
                key={h.time}
                className="min-w-[86px] rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-center"
              >
                <p className="text-xs text-muted-foreground">
                  {new Date(h.time).toLocaleTimeString([], { hour: "numeric" })}
                </p>
                <p className="mt-2 text-xl font-medium">{h.temp}°</p>
                <p className="mt-1 text-xs text-accent-foreground">{h.precip}%</p>
              </div>
            ))}
            {!data && <p className="text-sm text-muted-foreground">Loading forecast…</p>}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tap anywhere on the map to read conditions for that point.
        </p>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string | number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-medium">{value ?? "—"}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="h-full min-h-[360px] w-full animate-pulse rounded-2xl bg-secondary/50" />
  );
}
