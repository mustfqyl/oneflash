import nodemailer from "nodemailer";
import { getRootDomain } from "@/lib/subdomain";

interface LoginNotificationParams {
  to: string;
  ip: string;
  country?: string | null;
  city?: string | null;
  device?: string | null;
  time: Date;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = (process.env.FROM_EMAIL || `noreply@${getRootDomain()}`).trim();

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  };
}

export async function sendLoginNotification({
  to,
  ip,
  country,
  city,
  device,
  time,
}: LoginNotificationParams): Promise<void> {
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });

  const location = [city, country].filter(Boolean).join(", ") || "Unknown";
  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #000; color: #fff; border-radius: 12px;">
      <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
        ⚡ oneflash — New Login
      </h2>
      <div style="background: #111; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">IP Address</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${escapeHtml(ip)}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Location</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${escapeHtml(location)}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Device</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${escapeHtml(device || "Unknown")}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Time</p>
        <p style="margin: 0; font-size: 15px;">${escapeHtml(time.toISOString())}</p>
      </div>
      <p style="color: #666; font-size: 12px; margin: 0;">
        If this wasn't you, change your PIN immediately.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject: "⚡ oneflash — New Login Detected",
      html,
      text: [
        "oneflash - New Login",
        `IP Address: ${ip}`,
        `Location: ${location}`,
        `Device: ${device || "Unknown"}`,
        `Time: ${time.toISOString()}`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("Failed to send login notification:", error);
  }
}
