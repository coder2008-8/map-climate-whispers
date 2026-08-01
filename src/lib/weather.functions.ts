import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { WeatherPayload } from "./weather.server";

export const getWeatherForQuery = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<WeatherPayload> => {
    const { fetchWeather, geocodePlace } = await import("./weather.server");
    return fetchWeather(await geocodePlace(data.query));
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
  .handler(async ({ data }): Promise<WeatherPayload> => {
    const { fetchWeather } = await import("./weather.server");
    return fetchWeather({ name: data.name, lat: data.lat, lng: data.lng });
  });
