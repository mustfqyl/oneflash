import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ROOT_DOMAIN",
  "NEXT_PUBLIC_ROOT_DOMAIN",
  "ENCRYPTION_KEY",
] as const;

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasAdminEmailConfig() {
  return Boolean(
    process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim()
  );
}

async function isDatabaseReady() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const envReady =
    REQUIRED_ENV_VARS.every((name) => hasValue(name)) && hasAdminEmailConfig();
  const databaseReady = envReady ? await isDatabaseReady() : false;
  const ok = envReady && databaseReady;

  const response = NextResponse.json(
    {
      ok,
      checks: {
        env: envReady ? "ok" : "error",
        database: databaseReady ? "ok" : "error",
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );

  response.headers.set("Cache-Control", "no-store");
  return response;
}
