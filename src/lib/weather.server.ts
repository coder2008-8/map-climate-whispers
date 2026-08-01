const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type Place = {
  name: string;
  lat: number;
  lng: number;
};

export type HourPoint = {
  time: string;
  temp: number;
  precip: number;
};

export type WeatherPayload = {
  place: Place;
  current: {
    condition: string;
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    windGust: number | null;
    uvIndex: number | null;
    pressure: number | null;
    visibility: number | null;
    isDaytime: boolean;
  };
  hourly: HourPoint[];
  airQuality: { aqi: number; category: string } | null;
};

function headers(extra: Record<string, string> = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Maps connector credentials are missing.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    ...extra,
  };
}

async function gatewayFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${GATEWAY_URL}/${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      const reason = (() => {
        try {
          const parsed = JSON.parse(body) as {
            error?: { details?: Array<{ reason?: string }> };
          };
          return parsed.error?.details?.find((d) => d.reason)?.reason;
        } catch {
          return undefined;
        }
      })();
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        throw new Error(
          'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
        );
      }
      if (reason === "API_KEY_SERVICE_BLOCKED") {
        throw new Error(
          "Google Maps server key does not allow this API. Add it to the server key's allowed-APIs list in Google Cloud Console.",
        );
      }
    }
    console.error(`Gateway request failed [${response.status}]: ${body}`);
    if (response.status === 404) {
      throw new Error("NOT_SUPPORTED_LOCATION");
    }
    throw new Error(`Weather lookup failed [${response.status}]: ${body}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export async function geocodePlace(query: string): Promise<Place> {
  const data = (await gatewayFetch(
    `maps/api/geocode/json?address=${encodeURIComponent(query)}`,
    { headers: headers() },
  )) as {
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      address_components?: Array<{ long_name: string; types: string[] }>;
    }>;
  };
  const first = data.results?.[0];
  if (!first) throw new Error(`No location found for "${query}".`);
  const locality = first.address_components?.find((c) =>
    c.types.includes("locality"),
  )?.long_name;
  return {
    name: locality ?? first.formatted_address,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
  };
}

/** Turns raw coordinates into a human-readable place name. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const data = (await gatewayFetch(
      `maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|administrative_area_level_1|country`,
      { headers: headers() },
    )) as {
      results?: Array<{
        formatted_address: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    const first = data.results?.[0];
    if (!first) return null;
    const locality = first.address_components?.find((c) =>
      c.types.includes("locality"),
    )?.long_name;
    return locality ?? first.formatted_address;
  } catch {
    return null;
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function fetchWeather(place: Place): Promise<WeatherPayload> {
  const coords = `location.latitude=${place.lat}&location.longitude=${place.lng}`;

  const [current, forecast, air] = await Promise.all([
    gatewayFetch(`weather/v1/currentConditions:lookup?${coords}`, {
      headers: headers(),
    }).catch((err: Error) => {
      if (err.message === "NOT_SUPPORTED_LOCATION") {
        throw new Error(
          `Google doesn't provide weather data for ${place.name} yet. Try another location.`,
        );
      }
      throw err;
    }) as Promise<Record<string, any>>,
    gatewayFetch(`weather/v1/forecast/hours:lookup?${coords}&hours=12`, {
      headers: headers(),
    }).catch(() => null) as Promise<Record<string, any> | null>,
    gatewayFetch("airquality/v1/currentConditions:lookup", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        location: { latitude: place.lat, longitude: place.lng },
      }),
    }).catch(() => null) as Promise<Record<string, any> | null>,
  ]);

  const hourly: HourPoint[] = (forecast?.["forecastHours"] ?? [])
    .slice(0, 12)
    .map((h: any) => ({
      time: h?.interval?.startTime ?? "",
      temp: Math.round(h?.temperature?.degrees ?? 0),
      precip: h?.precipitation?.probability?.percent ?? 0,
    }));

  const index = air?.["indexes"]?.[0];

  return {
    place,
    current: {
      condition: titleCase(
        current["weatherCondition"]?.description?.text ??
          current["weatherCondition"]?.type ??
          "Unknown",
      ),
      temp: Math.round(current["temperature"]?.degrees ?? 0),
      feelsLike: Math.round(current["feelsLikeTemperature"]?.degrees ?? 0),
      humidity: current["relativeHumidity"] ?? 0,
      windSpeed: Math.round(current["wind"]?.speed?.value ?? 0),
      windDirection: current["wind"]?.direction?.degrees ?? 0,
      windGust: current["wind"]?.gust?.value
        ? Math.round(current["wind"].gust.value)
        : null,
      uvIndex: current["uvIndex"] ?? null,
      pressure: current["airPressure"]?.meanSeaLevelMillibars
        ? Math.round(current["airPressure"].meanSeaLevelMillibars)
        : null,
      visibility: current["visibility"]?.distance ?? null,
      isDaytime: Boolean(current["isDaytime"]),
    },
    hourly,
    airQuality: index
      ? { aqi: index.aqi ?? 0, category: index.category ?? "Unknown" }
      : null,
  };
}
