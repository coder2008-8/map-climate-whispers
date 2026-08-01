import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchWeather, geocodePlace } from "./weather.server";

export const getWeatherForQuery = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchWeather: run, geocodePlace: geo } = await import(
      "./weather.server"
    );
    return run(await geo(data.query));
  });

export const getWeatherForCoords = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchWeather: run } = await import("./weather.server");
    return run({ name: data.name, lat: data.lat, lng: data.lng });
  });

export type { WeatherPayload } from "./weather.server";
void fetchWeather;
void geocodePlace;
