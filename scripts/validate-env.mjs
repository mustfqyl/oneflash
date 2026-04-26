import "dotenv/config";

const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ROOT_DOMAIN",
  "NEXT_PUBLIC_ROOT_DOMAIN",
  "ENCRYPTION_KEY",
];

const optionalGroups = [
  {
    name: "Google OAuth",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    name: "Microsoft OAuth",
    vars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  },
  {
    name: "SMTP",
    vars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
  },
  {
    name: "Vercel integration",
    vars: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
  },
];

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

const errors = [];
const warnings = [];

for (const name of requiredEnvVars) {
  if (!readEnv(name)) {
    errors.push(`${name} is required.`);
  }
}

if (!readEnv("ADMIN_EMAILS") && !readEnv("ADMIN_EMAIL")) {
  errors.push("Either ADMIN_EMAILS or ADMIN_EMAIL must be configured.");
}

if (
  readEnv("ROOT_DOMAIN") &&
  readEnv("NEXT_PUBLIC_ROOT_DOMAIN") &&
  readEnv("ROOT_DOMAIN") !== readEnv("NEXT_PUBLIC_ROOT_DOMAIN")
) {
  errors.push("ROOT_DOMAIN and NEXT_PUBLIC_ROOT_DOMAIN must match.");
}

for (const group of optionalGroups) {
  const present = group.vars.filter((name) => readEnv(name));
  if (present.length > 0 && present.length !== group.vars.length) {
    warnings.push(
      `${group.name} is partially configured. Set all of: ${group.vars.join(", ")}.`
    );
  }
}

if (readEnv("NEXTAUTH_SECRET").length > 0 && readEnv("NEXTAUTH_SECRET").length < 32) {
  warnings.push("NEXTAUTH_SECRET should be at least 32 characters.");
}

if (readEnv("ENCRYPTION_KEY").length > 0 && readEnv("ENCRYPTION_KEY").length < 32) {
  warnings.push("ENCRYPTION_KEY should be at least 32 characters.");
}

const smtpPort = readEnv("SMTP_PORT");
if (smtpPort && Number.isNaN(Number(smtpPort))) {
  errors.push("SMTP_PORT must be a number.");
}

if (errors.length > 0) {
  console.error("Environment validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Environment validation passed.");

if (warnings.length > 0) {
  console.warn("Warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}
