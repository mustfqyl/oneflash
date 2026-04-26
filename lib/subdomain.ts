export const RESERVED_SUBDOMAINS = [
  "www",
  "admin",
  "api",
  "app",
  "mail",
  "oneflash",
  "help",
  "support",
  "guest",
] as const;

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/;
const DEFAULT_ROOT_DOMAIN = "oneflash.one";

export function getRootDomain() {
  return (
    process.env.ROOT_DOMAIN ||
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    DEFAULT_ROOT_DOMAIN
  ).toLowerCase();
}

export function isLocalRootDomain(rootDomain: string) {
  return (
    rootDomain === "localhost" ||
    rootDomain === "127.0.0.1" ||
    rootDomain === "lvh.me" ||
    rootDomain.endsWith(".localhost")
  );
}

export function normalizeSubdomain(value: string) {
  return value.trim().toLowerCase();
}

export function getSubdomainValidationError(value: string) {
  const normalized = normalizeSubdomain(value);

  if (!normalized) {
    return "Subdomain is required";
  }

  if (normalized.length < 3 || normalized.length > 32) {
    return "Subdomain must be 3-32 characters";
  }

  if (!SUBDOMAIN_PATTERN.test(normalized)) {
    return "Subdomain must start and end with a letter or number and can include hyphens in the middle";
  }

  if (RESERVED_SUBDOMAINS.includes(normalized as (typeof RESERVED_SUBDOMAINS)[number])) {
    return "Subdomain is reserved";
  }

  return null;
}

export function getSubdomainFromHost(host: string | null, rootDomain = getRootDomain()) {
  if (!host) {
    return null;
  }

  const normalizedHost = host.split(":")[0].toLowerCase();

  if (
    !normalizedHost ||
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost === rootDomain ||
    normalizedHost === `www.${rootDomain}` ||
    !normalizedHost.endsWith(`.${rootDomain}`)
  ) {
    return null;
  }

  const subdomain = normalizedHost.slice(0, -(`.${rootDomain}`.length));

  if (!subdomain || subdomain.includes(".")) {
    return null;
  }

  return subdomain;
}

export function getSubdomainUrl(
  subdomain: string,
  rootDomain = getRootDomain()
) {
  const normalizedSubdomain = normalizeSubdomain(subdomain);
  const protocol = isLocalRootDomain(rootDomain) ? "http" : "https";
  const port = isLocalRootDomain(rootDomain) ? ":3000" : "";

  return `${protocol}://${normalizedSubdomain}.${rootDomain}${port}`;
}
