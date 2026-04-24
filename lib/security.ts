import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type HeaderValue = string | string[] | undefined;
type HeaderSource = Headers | Record<string, HeaderValue>;

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

const RATE_LIMIT_STORE_KEY = Symbol.for("oneflash.rate-limit-store");

function getRateLimitStore() {
  const globalScope = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>;
  };

  if (!globalScope[RATE_LIMIT_STORE_KEY]) {
    globalScope[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>();
  }

  return globalScope[RATE_LIMIT_STORE_KEY];
}

export function getHeaderValue(headersSource: HeaderSource, name: string) {
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

export function getClientIp(headersSource: HeaderSource) {
  const forwardedFor = getHeaderValue(headersSource, "x-forwarded-for");
  const realIp = getHeaderValue(headersSource, "x-real-ip");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    "unknown"
  );
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitConfig): RateLimitResult {
  const store = getRateLimitStore();
  const now = Date.now();

  for (const [entryKey, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(entryKey);
    }
  }

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: 0,
      resetAt: now + windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      ),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - current.count, 0),
    retryAfterSeconds: 0,
    resetAt: current.resetAt,
  };
}

export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000))
  );

  if (!result.allowed) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds));
  }

  return response;
}

export function createRateLimitResponse(
  result: RateLimitResult,
  message = "Too many requests. Please try again later."
) {
  return withRateLimitHeaders(
    NextResponse.json(
      {
        error: message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: 429 }
    ),
    result
  );
}

function resolveCandidateOrigin(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  if (originHeader) {
    return originHeader;
  }

  const refererHeader = req.headers.get("referer");
  if (!refererHeader) {
    return null;
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return "invalid";
  }
}

function getTrustedOrigins(req: NextRequest) {
  const trustedOrigins = new Set<string>([req.nextUrl.origin]);

  if (process.env.NEXTAUTH_URL) {
    try {
      trustedOrigins.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {
      // Ignore malformed env values here and let runtime fail closer to auth usage.
    }
  }

  return trustedOrigins;
}

export function ensureTrustedOrigin(
  req: NextRequest,
  message = "Cross-site request rejected"
) {
  const candidateOrigin = resolveCandidateOrigin(req);
  if (!candidateOrigin || candidateOrigin === "invalid") {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const trustedOrigins = getTrustedOrigins(req);
  if (trustedOrigins.has(candidateOrigin)) {
    return null;
  }

  // Check against root domain and its subdomains
  try {
    const originUrl = new URL(candidateOrigin);
    const hostname = originUrl.hostname;

    if (process.env.NODE_ENV === "development" && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return null;
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN;
    if (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))) {
      return null;
    }
  } catch {
    // Ignore invalid origin URLs
  }

  console.warn(`[CSRF] Rejected origin: ${candidateOrigin}`);
  return NextResponse.json({ error: message }, { status: 403 });
}
