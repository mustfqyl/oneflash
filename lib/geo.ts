interface GeoResult {
  country: string | null;
  city: string | null;
}

type HeaderValue = string | string[] | null | undefined;
type HeaderSource = Headers | Record<string, HeaderValue>;

function getHeaderValue(headersSource: HeaderSource, name: string) {
  if (headersSource instanceof Headers) {
    return headersSource.get(name);
  }

  const directValue =
    headersSource[name] ?? headersSource[name.toLowerCase()] ?? undefined;

  if (Array.isArray(directValue)) {
    return directValue[0] ?? null;
  }

  return typeof directValue === "string" ? directValue : null;
}

function normalizeGeoValue(value: string | null) {
  if (!value || value === "XX" || value.toUpperCase() === "UNKNOWN") {
    return null;
  }

  return value;
}

function isLocalOrPrivateIp(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

export function getGeoFromHeaders(headersSource: HeaderSource): GeoResult | null {
  const country =
    normalizeGeoValue(getHeaderValue(headersSource, "cf-ipcountry")) ||
    normalizeGeoValue(getHeaderValue(headersSource, "cloudfront-viewer-country"));
  const city = normalizeGeoValue(getHeaderValue(headersSource, "cf-ipcity"));

  if (!country && !city) {
    return null;
  }

  return {
    country,
    city,
  };
}

export async function getGeoFromIP(
  ip: string,
  headersSource?: HeaderSource
): Promise<GeoResult> {
  const headerGeo = headersSource ? getGeoFromHeaders(headersSource) : null;
  if (headerGeo) {
    return headerGeo;
  }

  if (isLocalOrPrivateIp(ip)) {
    return { country: "Local", city: "Local" };
  }

  return { country: null, city: null };
}
