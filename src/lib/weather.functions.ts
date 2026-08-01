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
        name: z.string().min(1).max(120).optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WeatherPayload> => {
    const { fetchWeather, reverseGeocode } = await import("./weather.server");
    const { formatCoords } = await import("./coords");
    const name =
      data.name ??
      (await reverseGeocode(data.lat, data.lng)) ??
      formatCoords({ lat: data.lat, lng: data.lng });
    return fetchWeather({ name, lat: data.lat, lng: data.lng });
  });
