import Link from "next/link";
import {
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  SignalIcon,
  FolderIcon,
  ShieldCheckIcon,
  ClockIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { getRootDomain, getSubdomainUrl } from "@/lib/subdomain";
import { prisma } from "@/lib/prisma";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_LIMIT = 12;
const RECENT_USER_LOGS_LIMIT = 10;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

async function getAdminUsers(query: string) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { customDomain: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      customDomain: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
      cloudAccounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          email: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      guestLinks: {
        select: {
          id: true,
          token: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      trustedDevices: {
        select: {
          id: true,
          deviceName: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      accessLogs: {
        select: {
          id: true,
          ip: true,
          country: true,
          city: true,
          device: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>[number];

type ActivityEntry = {
  userId: string;
  userLabel: string;
  username: string;
  createdAt: Date;
  ip: string;
  country: string | null;
  city: string | null;
  device: string | null;
};

type SearchParams = Promise<{
  q?: string | string[] | undefined;
}>;

function readSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return dateTimeFormatter.format(new Date(value));
}

function formatRelativeTime(
  value: Date | string | null | undefined,
  nowTimestamp: number
) {
  if (!value) {
    return "Never";
  }

  const timestamp = new Date(value).getTime();
  const elapsed = timestamp - nowTimestamp;
  const absElapsed = Math.abs(elapsed);

  if (absElapsed < 60 * 1000) {
    return "just now";
  }

  const ranges = [
    { unit: "day" as const, ms: DAY_IN_MS },
    { unit: "hour" as const, ms: 60 * 60 * 1000 },
    { unit: "minute" as const, ms: 60 * 1000 },
  ];

  const selectedRange =
    ranges.find((range) => absElapsed >= range.ms) ?? ranges[ranges.length - 1];

  return relativeTimeFormatter.format(
    Math.round(elapsed / selectedRange.ms),
    selectedRange.unit
  );
}

function compactNumber(value: number) {
  return compactNumberFormatter.format(value);
}

function formatPlan(plan: AdminUser["plan"]) {
  return plan === "PRO" ? "Pro" : "Free";
}

function getProviderLabel(provider: AdminUser["cloudAccounts"][number]["provider"]) {
  switch (provider) {
    case "GOOGLE_DRIVE":
      return "Google Drive";
    case "ONEDRIVE":
      return "OneDrive";
    case "ICLOUD":
      return "iCloud";
    default:
      return provider;
  }
}

function getProviderAccent(provider: AdminUser["cloudAccounts"][number]["provider"]) {
  switch (provider) {
    case "GOOGLE_DRIVE":
      return "border-blue-500/20 bg-blue-500/10 text-blue-200";
    case "ONEDRIVE":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
    case "ICLOUD":
      return "border-slate-400/20 bg-slate-400/10 text-slate-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function getPlanAccent(plan: AdminUser["plan"]) {
  return plan === "PRO"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
    : "border-white/10 bg-white/5 text-white/72";
}

function summarizeDevice(device: string | null) {
  if (!device) {
    return "Unknown device";
  }

  const value = device.toLowerCase();

  const browser = value.includes("edg/")
    ? "Edge"
    : value.includes("chrome/")
      ? "Chrome"
      : value.includes("firefox/")
        ? "Firefox"
        : value.includes("safari/") && !value.includes("chrome/")
          ? "Safari"
          : value.includes("iphone")
            ? "iPhone"
            : "Unknown browser";

  const platform = value.includes("iphone")
    ? "iPhone"
    : value.includes("ipad")
      ? "iPad"
      : value.includes("android")
        ? "Android"
        : value.includes("mac os x") || value.includes("macintosh")
          ? "macOS"
          : value.includes("windows")
            ? "Windows"
            : value.includes("linux")
              ? "Linux"
              : "Unknown OS";

  if (browser === "Unknown browser" && platform === "Unknown OS") {
    return device;
  }

  return `${browser} on ${platform}`;
}

function countValues(values: Array<string>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function getTopEntries(values: Array<string>, limit = 4) {
  return Array.from(countValues(values).entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit);
}

function isActiveInWindow(
  value: Date | string,
  windowMs: number,
  nowTimestamp: number
) {
  return nowTimestamp - new Date(value).getTime() <= windowMs;
}

function average(value: number, divisor: number) {
  if (divisor === 0) {
    return 0;
  }

  return value / divisor;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const rootDomain = getRootDomain();
  const query = readSearchValue((await searchParams)?.q);
  const [users, databaseNowRows] = await Promise.all([
    getAdminUsers(query),
    prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`,
  ]);
  const nowTimestamp = new Date(databaseNowRows[0].now).getTime();

  const activityEntries = users
    .flatMap((user) =>
      user.accessLogs.map(
        (log): ActivityEntry => ({
          userId: user.id,
          userLabel: user.name?.trim() || user.username,
          username: user.username,
          createdAt: new Date(log.createdAt),
          ip: log.ip,
          country: log.country,
          city: log.city,
          device: log.device,
        })
      )
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const cloudAccounts = users.flatMap((user) => user.cloudAccounts);
  const guestLinks = users.flatMap((user) => user.guestLinks);
  const trustedDevices = users.flatMap((user) => user.trustedDevices);

  const totalUsers = users.length;
  const totalConnections = cloudAccounts.length;
  const totalAccessEvents = activityEntries.length;
  const activeUsers24h = users.filter((user) =>
    user.accessLogs.some((log) =>
      isActiveInWindow(log.createdAt, DAY_IN_MS, nowTimestamp)
    )
  ).length;
  const activeUsers7d = users.filter((user) =>
    user.accessLogs.some((log) =>
      isActiveInWindow(log.createdAt, DAY_IN_MS * 7, nowTimestamp)
    )
  ).length;
  const activeUsers30d = users.filter((user) =>
    user.accessLogs.some((log) =>
      isActiveInWindow(log.createdAt, DAY_IN_MS * 30, nowTimestamp)
    )
  ).length;

  const activeGuestLinks = guestLinks.filter(
    (link) => new Date(link.expiresAt).getTime() > nowTimestamp
  ).length;
  const activeTrustedDevices = trustedDevices.filter(
    (device) => new Date(device.expiresAt).getTime() > nowTimestamp
  ).length;
  const connectedDomains = users.filter((user) => user.customDomain).length;
  const usersOnProPlan = users.filter((user) => user.plan === "PRO").length;
  const averageConnectionsPerUser = average(totalConnections, Math.max(totalUsers, 1));
  const averageAccessEventsPerUser = average(totalAccessEvents, Math.max(totalUsers, 1));

  const planBreakdown = [
    { label: "Pro", count: usersOnProPlan },
    { label: "Free", count: totalUsers - usersOnProPlan },
  ];
  const providerBreakdown = [
    {
      label: "Google Drive",
      count: cloudAccounts.filter((account) => account.provider === "GOOGLE_DRIVE").length,
    },
    {
      label: "OneDrive",
      count: cloudAccounts.filter((account) => account.provider === "ONEDRIVE").length,
    },
    {
      label: "iCloud",
      count: cloudAccounts.filter((account) => account.provider === "ICLOUD").length,
    },
  ];
  const recentActivity = activityEntries.slice(0, RECENT_ACTIVITY_LIMIT);
  const topCountries = getTopEntries(
    activityEntries.map((entry) => entry.country || "Unknown country")
  );
  const topCities = getTopEntries(
    activityEntries.map((entry) =>
      entry.city ? `${entry.city}, ${entry.country || "Unknown"}` : "Unknown city"
    )
  );
  const topDevices = getTopEntries(
    activityEntries.map((entry) => summarizeDevice(entry.device))
  );

  return (
    <div className="space-y-8">
      <section className="motion-enter rounded-[30px] border border-white/8 bg-surface-soft p-6 shadow-[0_20px_70px_rgba(2,8,23,0.24)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-blue-300">
              <SignalIcon className="h-3.5 w-3.5" />
              Platform overview
            </div>
            <h2 className="mt-4 font-outfit text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Detailed user intelligence across growth, activity, security, and storage.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
              This view exposes every meaningful user-facing operational field in the database:
              identities, domains, plans, cloud connections, guest links, trusted devices, access history, and geo/device footprints.
              Secret material like password hashes, PIN hashes, and OAuth tokens stays hidden.
            </p>
          </div>

          <form className="flex w-full max-w-xl flex-col gap-3 sm:flex-row lg:justify-end" action="/admin/users">
            <label className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search by email, username, display name, or subdomain"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-blue-400/50"
              />
            </label>
            <button
              type="submit"
              className="motion-hover-lift motion-press inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Filter
            </button>
            {query ? (
              <Link
                href="/admin/users"
                className="motion-hover-lift motion-press inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/72 hover:bg-white/10 hover:text-white"
              >
                Reset
              </Link>
            ) : null}
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 motion-stagger-children">
        <MetricCard
          icon={<UserGroupIcon className="h-5 w-5" />}
          label="Users"
          value={compactNumber(totalUsers)}
          detail={`${usersOnProPlan} Pro plan / ${Math.max(totalUsers - usersOnProPlan, 0)} Free`}
        />
        <MetricCard
          icon={<FolderIcon className="h-5 w-5" />}
          label="Cloud Connections"
          value={compactNumber(totalConnections)}
          detail={`${averageConnectionsPerUser.toFixed(1)} per user average`}
        />
        <MetricCard
          icon={<ShieldCheckIcon className="h-5 w-5" />}
          label="Trusted Devices"
          value={compactNumber(activeTrustedDevices)}
          detail={`${trustedDevices.length} recorded / ${activeGuestLinks} active guest links`}
        />
        <MetricCard
          icon={<ClockIcon className="h-5 w-5" />}
          label="Recent Activity"
          value={compactNumber(activeUsers7d)}
          detail={`${activeUsers24h} active in 24h / ${activeUsers30d} active in 30d`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="motion-enter motion-enter-delay-1 rounded-[28px] border border-white/8 bg-surface p-6 shadow-[0_18px_60px_rgba(2,8,23,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-outfit text-2xl font-semibold text-white">
                Platform breakdown
              </h3>
              <p className="mt-2 text-sm text-white/60">
                Plan mix, provider coverage, domains, and overall usage density.
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-right">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/42">
                Access events
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {compactNumber(totalAccessEvents)}
              </div>
              <div className="mt-1 text-xs text-white/52">
                {averageAccessEventsPerUser.toFixed(1)} per user average
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DistributionPanel
              title="Plans"
              entries={planBreakdown}
              total={Math.max(totalUsers, 1)}
            />
            <DistributionPanel
              title="Providers"
              entries={providerBreakdown}
              total={Math.max(totalConnections, 1)}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InsightStat
              label="Configured subdomains"
              value={`${connectedDomains}/${totalUsers}`}
            />
            <InsightStat
              label="Active users in 7d"
              value={`${activeUsers7d}/${totalUsers}`}
            />
            <InsightStat
              label="Recorded trusted devices"
              value={compactNumber(trustedDevices.length)}
            />
          </div>
        </div>

        <div className="motion-enter motion-enter-delay-2 rounded-[28px] border border-white/8 bg-surface p-6 shadow-[0_18px_60px_rgba(2,8,23,0.24)]">
          <h3 className="font-outfit text-2xl font-semibold text-white">
            Traffic signature
          </h3>
          <p className="mt-2 text-sm text-white/60">
            Access geography, device mix, and the most recent sessions.
          </p>

          <div className="mt-6 space-y-5">
            <TopList title="Top countries" entries={topCountries} emptyLabel="No access data yet" />
            <TopList title="Top cities" entries={topCities} emptyLabel="No location data yet" />
            <TopList title="Top devices" entries={topDevices} emptyLabel="No device data yet" />
          </div>
        </div>
      </section>

      <section className="motion-enter motion-enter-delay-3 rounded-[28px] border border-white/8 bg-surface p-6 shadow-[0_18px_60px_rgba(2,8,23,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-outfit text-2xl font-semibold text-white">
              Recent platform activity
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Last {RECENT_ACTIVITY_LIMIT} PIN-authenticated access events across all users.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white/64">
            {query
              ? `Filtered to ${totalUsers} matching users`
              : `${totalUsers} total users loaded`}
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((entry) => (
              <div
                key={`${entry.userId}-${entry.createdAt.toISOString()}-${entry.ip}`}
                className="motion-list-row grid gap-3 rounded-2xl border border-white/8 bg-black/18 p-4 md:grid-cols-[1.2fr_0.9fr_1fr]"
              >
                <div>
                  <div className="font-semibold text-white">{entry.userLabel}</div>
                  <div className="mt-1 text-sm text-white/56">@{entry.username}</div>
                </div>
                <div className="text-sm text-white/70">
                  <div>{entry.city || "Unknown city"}</div>
                  <div className="mt-1 text-white/48">{entry.country || "Unknown country"}</div>
                </div>
                <div className="text-sm text-white/70 md:text-right">
                  <div>{summarizeDevice(entry.device)}</div>
                  <div className="mt-1 text-white/48">
                    {formatDateTime(entry.createdAt)} · {entry.ip}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-white/55">
              No access activity has been recorded for the selected dataset yet.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="motion-enter motion-enter-delay-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-outfit text-2xl font-semibold text-white">
              User detail cards
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Identity, lifecycle, storage, sharing, device trust, and recent access for every user.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            Non-secret operational fields
          </div>
        </div>

        {users.length > 0 ? (
          <div className="space-y-6 motion-stagger-children">
            {users.map((user) => {
              const latestAccess = user.accessLogs[0]?.createdAt ?? null;
              const activeTrustedDeviceCount = user.trustedDevices.filter(
                (device) => new Date(device.expiresAt).getTime() > nowTimestamp
              ).length;
              const activeGuestLinkCount = user.guestLinks.filter(
                (link) => new Date(link.expiresAt).getTime() > nowTimestamp
              ).length;
              const topUserCountries = getTopEntries(
                user.accessLogs.map((log) => log.country || "Unknown country"),
                3
              );
              const topUserDevices = getTopEntries(
                user.accessLogs.map((log) => summarizeDevice(log.device)),
                3
              );
              const uniqueIps = new Set(user.accessLogs.map((log) => log.ip)).size;
              const domainUrl = user.customDomain
                ? getSubdomainUrl(user.customDomain, rootDomain)
                : null;

              return (
                <article
                  key={user.id}
                  className="motion-list-row overflow-hidden rounded-[30px] border border-white/8 bg-surface shadow-[0_18px_60px_rgba(2,8,23,0.24)]"
                >
                  <div className="border-b border-white/8 bg-gradient-to-r from-blue-500/8 via-transparent to-cyan-400/8 px-6 py-6 sm:px-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="font-outfit text-2xl font-semibold text-white">
                            {user.name?.trim() || user.username}
                          </h4>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getPlanAccent(
                              user.plan
                            )}`}
                          >
                            {formatPlan(user.plan)}
                          </span>
                          {latestAccess ? (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                              Active {formatRelativeTime(latestAccess, nowTimestamp)}
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                              No access history
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-sm text-white/70">
                          {user.email}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/65">
                            @{user.username}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-white/65">
                            {user.id}
                          </span>
                          {domainUrl ? (
                            <a
                              href={domainUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="motion-hover-lift inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-blue-200"
                            >
                              {user.customDomain}.{rootDomain}
                              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/52">
                              No subdomain configured
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-4">
                        <MiniMetric label="Access events" value={String(user.accessLogs.length)} />
                        <MiniMetric label="Connections" value={String(user.cloudAccounts.length)} />
                        <MiniMetric label="Guest links" value={String(user.guestLinks.length)} />
                        <MiniMetric label="Trusted devices" value={String(user.trustedDevices.length)} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-2">
                    <PanelBlock
                      icon={<UserGroupIcon className="h-5 w-5" />}
                      title="Identity & lifecycle"
                      description="Core account fields and domain ownership."
                    >
                      <KeyValueRow label="Email" value={user.email} mono />
                      <KeyValueRow label="Display name" value={user.name?.trim() || "Not set"} />
                      <KeyValueRow label="Username" value={`@${user.username}`} />
                      <KeyValueRow
                        label="Subdomain"
                        value={
                          user.customDomain
                            ? `${user.customDomain}.${rootDomain}`
                            : "Not configured"
                        }
                      />
                      <KeyValueRow label="Plan" value={formatPlan(user.plan)} />
                      <KeyValueRow label="Joined" value={formatDateTime(user.createdAt)} />
                      <KeyValueRow label="Last updated" value={formatDateTime(user.updatedAt)} />
                    </PanelBlock>

                    <PanelBlock
                      icon={<SignalIcon className="h-5 w-5" />}
                      title="Activity intelligence"
                      description="Behavioral footprint from PIN-authenticated sessions."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MiniMetric
                          label="Last access"
                          value={formatRelativeTime(latestAccess, nowTimestamp)}
                        />
                        <MiniMetric label="Unique IPs" value={String(uniqueIps)} />
                        <MiniMetric
                          label="24h active"
                          value={String(
                            user.accessLogs.filter((log) =>
                              isActiveInWindow(log.createdAt, DAY_IN_MS, nowTimestamp)
                            ).length
                          )}
                        />
                        <MiniMetric
                          label="7d active"
                          value={String(
                            user.accessLogs.filter((log) =>
                              isActiveInWindow(log.createdAt, DAY_IN_MS * 7, nowTimestamp)
                            ).length
                          )}
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TopList
                          title="Top countries"
                          entries={topUserCountries}
                          emptyLabel="No geo data"
                          compact
                        />
                        <TopList
                          title="Top devices"
                          entries={topUserDevices}
                          emptyLabel="No device data"
                          compact
                        />
                      </div>
                    </PanelBlock>

                    <PanelBlock
                      icon={<FolderIcon className="h-5 w-5" />}
                      title="Cloud connections"
                      description="Attached storage accounts and current token expiry posture."
                    >
                      {user.cloudAccounts.length > 0 ? (
                        <div className="space-y-3">
                          {user.cloudAccounts.map((account) => {
                            const isTokenActive =
                              !account.expiresAt ||
                              new Date(account.expiresAt).getTime() > nowTimestamp;

                            return (
                              <div
                                key={account.id}
                                className="rounded-2xl border border-white/8 bg-black/18 p-4"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getProviderAccent(
                                      account.provider
                                    )}`}
                                  >
                                    {getProviderLabel(account.provider)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/62">
                                    {isTokenActive ? "Token active" : "Token refresh due"}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm text-white/70">
                                  <KeyValueRow
                                    label="Storage email"
                                    value={account.email || "Not provided"}
                                    mono
                                  />
                                  <KeyValueRow
                                    label="Provider account ID"
                                    value={account.providerAccountId || "Not provided"}
                                    mono
                                  />
                                  <KeyValueRow
                                    label="Connected at"
                                    value={formatDateTime(account.createdAt)}
                                  />
                                  <KeyValueRow
                                    label="Token expiry"
                                    value={formatDateTime(account.expiresAt)}
                                  />
                                  <KeyValueRow label="Record" value={account.id} mono />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState label="No storage providers connected." />
                      )}
                    </PanelBlock>

                    <PanelBlock
                      icon={<ShieldCheckIcon className="h-5 w-5" />}
                      title="Security & sharing"
                      description="Guest link exposure and remembered-device footprint."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MiniMetric label="Active guest links" value={String(activeGuestLinkCount)} />
                        <MiniMetric label="Active trusted devices" value={String(activeTrustedDeviceCount)} />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <SubList title="Guest links" emptyLabel="No guest links">
                          {user.guestLinks.map((link) => (
                            <li
                              key={link.id}
                              className="rounded-2xl border border-white/8 bg-black/18 p-3"
                            >
                              <div className="font-mono text-xs text-white/72 break-all">
                                /guest/{link.token}
                              </div>
                              <div className="mt-2 text-xs text-white/48">
                                Created {formatDateTime(link.createdAt)} · Expires {formatDateTime(link.expiresAt)}
                              </div>
                            </li>
                          ))}
                        </SubList>

                        <SubList title="Trusted devices" emptyLabel="No trusted devices">
                          {user.trustedDevices.map((device) => (
                            <li
                              key={device.id}
                              className="rounded-2xl border border-white/8 bg-black/18 p-3"
                            >
                              <div className="text-sm font-semibold text-white">
                                {summarizeDevice(device.deviceName)}
                              </div>
                              <div className="mt-2 text-xs text-white/48">
                                Created {formatDateTime(device.createdAt)} · Expires {formatDateTime(device.expiresAt)}
                              </div>
                              <div className="mt-2 font-mono text-[11px] text-white/44">
                                {device.id}
                              </div>
                            </li>
                          ))}
                        </SubList>
                      </div>
                    </PanelBlock>

                    <PanelBlock
                      icon={<GlobeAltIcon className="h-5 w-5" />}
                      title="Recent access log"
                      description={`Showing the latest ${Math.min(
                        user.accessLogs.length,
                        RECENT_USER_LOGS_LIMIT
                      )} of ${user.accessLogs.length} events.`}
                      className="xl:col-span-2"
                    >
                      {user.accessLogs.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-white/8">
                          <div className="overflow-x-auto">
                          <div className="grid grid-cols-[1.2fr_1fr_1.6fr_1fr] gap-4 border-b border-white/8 bg-white/5 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/48">
                            <span>When</span>
                            <span>IP</span>
                            <span>Location</span>
                            <span>Device</span>
                          </div>
                          <div className="divide-y divide-white/8">
                            {user.accessLogs.slice(0, RECENT_USER_LOGS_LIMIT).map((log) => (
                              <div
                                key={log.id}
                                className="grid grid-cols-[1.2fr_1fr_1.6fr_1fr] gap-4 bg-black/12 px-4 py-3 text-sm text-white/72"
                              >
                                <span>{formatDateTime(log.createdAt)}</span>
                                <span className="font-mono text-white/62">{log.ip}</span>
                                <span>
                                  {log.city || "Unknown city"}
                                  <span className="text-white/42">
                                    {" "}
                                    · {log.country || "Unknown country"}
                                  </span>
                                </span>
                                <span className="truncate text-white/62">
                                  {summarizeDevice(log.device)}
                                </span>
                              </div>
                            ))}
                          </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState label="No access events recorded yet." />
                      )}
                    </PanelBlock>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-surface p-10 text-center text-white/58">
            No users matched the current filter.
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-surface p-5 shadow-[0_18px_60px_rgba(2,8,23,0.22)]">
      <div className="flex items-center gap-3 text-blue-300">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2.5">
          {icon}
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/48">
          {label}
        </span>
      </div>
      <div className="mt-5 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-white/56">{detail}</div>
    </div>
  );
}

function DistributionPanel({
  title,
  entries,
  total,
}: {
  title: string;
  entries: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/18 p-5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/52">
        {title}
      </h4>
      <div className="mt-4 space-y-4">
        {entries.map((entry) => {
          const percentage = total > 0 ? (entry.count / total) * 100 : 0;

          return (
            <div key={entry.label}>
              <div className="mb-2 flex items-center justify-between text-sm text-white/72">
                <span>{entry.label}</span>
                <span>
                  {entry.count} · {percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                  style={{ width: `${Math.max(percentage, entry.count > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TopList({
  title,
  entries,
  emptyLabel,
  compact = false,
}: {
  title: string;
  entries: Array<[string, number]>;
  emptyLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[24px] border border-white/8 bg-black/18 ${compact ? "p-4" : "p-5"}`}>
      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/52">
        {title}
      </h4>
      {entries.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {entries.map(([label, count]) => (
            <li key={label} className="flex items-center justify-between gap-4 text-sm text-white/72">
              <span className="min-w-0 truncate">{label}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/62">
                {count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 text-sm text-white/45">{emptyLabel}</div>
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/44">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function PanelBlock({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[24px] border border-white/8 bg-black/18 p-5 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-2.5 text-blue-300">
          {icon}
        </div>
        <div>
          <h5 className="text-lg font-semibold text-white">{title}</h5>
          <p className="mt-1 text-sm text-white/54">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function KeyValueRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-white/48">{label}</span>
      <span
        className={`max-w-[68%] text-right text-sm text-white/78 ${mono ? "font-mono break-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function SubList({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div>
      <h6 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/52">
        {title}
      </h6>
      {hasChildren ? (
        <ul className="mt-3 space-y-3">{children}</ul>
      ) : (
        <EmptyState label={emptyLabel} className="mt-3" />
      )}
    </div>
  );
}

function EmptyState({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-white/10 bg-black/18 px-4 py-6 text-sm text-white/48 ${className}`.trim()}
    >
      {label}
    </div>
  );
}
