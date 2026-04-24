interface GeoResult {
  country: string | null;
  city: string | null;
}

export async function getGeoFromIP(ip: string): Promise<GeoResult> {
  try {
    // Skip for localhost/private IPs
    if (
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.")
    ) {
      return { country: "Local", city: "Local" };
    }

    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city`);
    if (!res.ok) return { country: null, city: null };

    const data = await res.json();
    return {
      country: data.country || null,
      city: data.city || null,
    };
  } catch {
    return { country: null, city: null };
  }
}
