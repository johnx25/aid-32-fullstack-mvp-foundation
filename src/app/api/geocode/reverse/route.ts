import { fail, ok } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";

// Privacy-safe reverse geocoding:
// We only return city + country, never street/house number or precise coordinates.
// We use the open-source Nominatim API (OpenStreetMap) — no API key required.
// Coordinates are rounded to 2 decimal places (~1km accuracy) before forwarding.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "AID-32 Tamil Dating MVP (contact: admin@example.com)";

function roundCoord(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function extractCity(address: Record<string, string>): string | null {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    null
  );
}

export async function GET(request: Request) {
  try {
    // Require authentication — GPS data is personal
    await requireCurrentUserId();
  } catch {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { searchParams } = new URL(request.url);
  const rawLat = searchParams.get("lat");
  const rawLon = searchParams.get("lon");

  if (!rawLat || !rawLon) {
    return fail(400, "BAD_REQUEST", "lat and lon query parameters are required");
  }

  const lat = parseFloat(rawLat);
  const lon = parseFloat(rawLon);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return fail(400, "BAD_REQUEST", "Invalid coordinates");
  }

  // Round to ~1km precision to avoid storing exact location
  const safeLat = roundCoord(lat, 2);
  const safeLon = roundCoord(lon, 2);

  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${safeLat}&lon=${safeLon}&format=jsonv2&addressdetails=1&zoom=10`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "de,en",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return fail(502, "GEOCODE_ERROR", "Reverse geocoding service unavailable");
    }

    const data = (await response.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };

    const address = data.address ?? {};
    const city = extractCity(address);
    const country = address.country ?? null;
    const countryCode = address.country_code?.toUpperCase() ?? null;

    if (!city) {
      return fail(422, "GEOCODE_NO_CITY", "Could not determine city from coordinates");
    }

    // Only return city + country — never street, house number, or precise location
    return ok({ city, country, countryCode });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return fail(504, "GEOCODE_TIMEOUT", "Geocoding request timed out");
    }
    return fail(502, "GEOCODE_ERROR", "Reverse geocoding failed");
  }
}
