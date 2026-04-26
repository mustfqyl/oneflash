import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { isRetriableDatabaseError, withDatabaseRetry } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getSubdomainFromHost } from "@/lib/subdomain";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { normalizeEmail } from "@/lib/validation";

type SessionBackedUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  customDomain: string | null;
};

type CookieSource = {
  get(name: string): { value: string } | undefined;
};

type HeaderSource = {
  get(name: string): string | null;
};

export type AccessContext = {
  mode: "session" | "trusted-device";
  subdomain: string | null;
  user: SessionBackedUser;
};

const TRUSTED_DEVICE_COOKIE_NAME = "trusted_device";

function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email =
          typeof credentials?.email === "string"
            ? normalizeEmail(credentials.email)
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const loginRateLimit = checkRateLimit({
          key: `login:${getClientIp(req.headers || {})}:${email}`,
          limit: 8,
          windowMs: 15 * 60 * 1000,
        });
        if (!loginRateLimit.allowed) {
          throw new Error(
            "Too many login attempts. Please wait a few minutes and try again."
          );
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email },
              { username: email }
            ]
          },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            username: true,
            customDomain: true,
          },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username,
          username: user.username,
          customDomain: user.customDomain,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username;
        token.customDomain = (user as { customDomain?: string | null }).customDomain;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username =
          token.username as string;
        (session.user as { customDomain?: string | null }).customDomain =
          (token.customDomain as string | null) || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

function getAdminEmails() {
  const configuredEmails =
    process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";

  return new Set(
    configuredEmails
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().has(normalizeEmail(email));
}

async function getSessionUser(subdomain: string | null) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | {
        id?: string;
        email?: string | null;
        username?: string | null;
        name?: string | null;
        customDomain?: string | null;
      }
    | undefined;

  if (!sessionUser?.id || !sessionUser.email || !sessionUser.username) {
    return null;
  }

  if (subdomain && sessionUser.customDomain !== subdomain) {
    return null;
  }

  return {
    mode: "session" as const,
    subdomain,
    user: {
      id: sessionUser.id,
      email: sessionUser.email,
      username: sessionUser.username,
      name: sessionUser.name || sessionUser.username,
      customDomain: sessionUser.customDomain || null,
    },
  };
}

async function getTrustedDeviceUser(subdomain: string | null, cookieStore: CookieSource) {
  if (!subdomain) {
    return null;
  }

  const trustedDeviceToken = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
  if (!trustedDeviceToken) {
    return null;
  }

  const trustedDeviceTokenHash = hashTrustedDeviceToken(trustedDeviceToken);

  let device;

  try {
    device = await withDatabaseRetry(() =>
      prisma.trustedDevice.findFirst({
        where: {
          OR: [
            { token: trustedDeviceTokenHash },
            { token: trustedDeviceToken },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              customDomain: true,
            },
          },
        },
      })
    );
  } catch (error) {
    if (isRetriableDatabaseError(error)) {
      return null;
    }

    throw error;
  }

  if (!device) {
    return null;
  }

  if (device.token !== trustedDeviceTokenHash) {
    await prisma.trustedDevice
      .update({
        where: { id: device.id },
        data: { token: trustedDeviceTokenHash },
      })
      .catch(() => undefined);
  }

  if (device.expiresAt <= new Date()) {
    await prisma.trustedDevice
      .delete({
        where: { id: device.id },
      })
      .catch(() => undefined);
    return null;
  }

  if (device.user.customDomain !== subdomain) {
    return null;
  }

  return {
    mode: "trusted-device" as const,
    subdomain,
    user: {
      id: device.user.id,
      email: device.user.email,
      username: device.user.username,
      name: device.user.name || device.user.username,
      customDomain: device.user.customDomain,
    },
  };
}

function getSubdomainFromHeaders(headerSource: HeaderSource) {
  return getSubdomainFromHost(
    headerSource.get("x-forwarded-host") || headerSource.get("host")
  );
}

async function resolveAccess(
  headerSource: HeaderSource,
  cookieStore: CookieSource,
  allowTrustedDevice: boolean
) {
  const subdomain = getSubdomainFromHeaders(headerSource);
  const sessionAccess = await getSessionUser(subdomain);

  if (sessionAccess) {
    return { access: sessionAccess, subdomain };
  }

  if (!allowTrustedDevice) {
    return { access: null, subdomain };
  }

  const trustedDeviceAccess = await getTrustedDeviceUser(subdomain, cookieStore);
  return { access: trustedDeviceAccess, subdomain };
}

export async function resolveServerAccess(options?: {
  allowTrustedDevice?: boolean;
}) {
  const headerSource = await headers();
  const cookieStore = await cookies();

  return resolveAccess(
    headerSource,
    cookieStore,
    options?.allowTrustedDevice ?? false
  );
}

export async function resolveRequestAccess(
  req: NextRequest,
  options?: { allowTrustedDevice?: boolean }
) {
  return resolveAccess(
    req.headers,
    req.cookies,
    options?.allowTrustedDevice ?? false
  );
}

export async function revokeTrustedDeviceToken(token: string | undefined) {
  if (!token) {
    return;
  }

  const trustedDeviceTokenHash = hashTrustedDeviceToken(token);

  await prisma.trustedDevice.deleteMany({
    where: {
      OR: [
        { token: trustedDeviceTokenHash },
        { token },
      ],
    },
  });
}

export function clearTrustedDeviceCookie(response: NextResponse) {
  response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
