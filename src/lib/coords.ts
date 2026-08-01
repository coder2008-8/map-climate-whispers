export type Coords = { lat: number; lng: number };

const DECIMAL =
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** "12.9716° N, 77.5946° E" — decimal degrees with an optional ° and hemisphere letter. */
const DECIMAL_HEMI =
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSns])\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])\s*$/;

const DMS =
  /^\s*(\d{1,3})(?:°|\s)\s*(\d{1,2}(?:\.\d+)?)?['′\s]*\s*(\d{1,2}(?:\.\d+)?)?["″]?\s*([NSns])\s*[, ]\s*(\d{1,3})(?:°|\s)\s*(\d{1,2}(?:\.\d+)?)?['′\s]*\s*(\d{1,2}(?:\.\d+)?)?["″]?\s*([EWew])\s*$/;

function dms(d: string, m?: string, s?: string, hemi?: string) {
  const value =
    Number(d) + Number(m ?? 0) / 60 + Number(s ?? 0) / 3600;
  return /[SsWw]/.test(hemi ?? "") ? -value : value;
}

/** Parses "40.71, -74.01", "40.71 -74.01" or "40°42'46\"N, 74°0'21\"W". */
export function parseCoordinates(input: string): Coords | null {
  const decimal = DECIMAL.exec(input);
  if (decimal) {
    return valid({ lat: Number(decimal[1]), lng: Number(decimal[2]) });
  }
  const hemi = DECIMAL_HEMI.exec(input);
  if (hemi) {
    const lat = Math.abs(Number(hemi[1])) * (/[Ss]/.test(hemi[2]!) ? -1 : 1);
    const lng = Math.abs(Number(hemi[3])) * (/[Ww]/.test(hemi[4]!) ? -1 : 1);
    return valid({ lat, lng });
  }
  const sexagesimal = DMS.exec(input);
  if (sexagesimal) {
    const [, d1, m1, s1, h1, d2, m2, s2, h2] = sexagesimal;
    return valid({
      lat: dms(d1!, m1, s1, h1),
      lng: dms(d2!, m2, s2, h2),
    });
  }
  return null;
}

function valid(c: Coords): Coords | null {
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
  if (Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) return null;
  return c;
}

export function formatCoords({ lat, lng }: Coords) {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${
    lng >= 0 ? "E" : "W"
  }`;
}
