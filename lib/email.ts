import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface LoginNotificationParams {
  to: string;
  ip: string;
  country?: string | null;
  city?: string | null;
  device?: string | null;
  time: Date;
}

export async function sendLoginNotification({
  to,
  ip,
  country,
  city,
  device,
  time,
}: LoginNotificationParams): Promise<void> {
  const location = [city, country].filter(Boolean).join(", ") || "Unknown";

  const html = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #000; color: #fff; border-radius: 12px;">
      <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
        ⚡ oneflash — New Login
      </h2>
      <div style="background: #111; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">IP Address</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${ip}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Location</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${location}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Device</p>
        <p style="margin: 0 0 16px; font-size: 15px;">${device || "Unknown"}</p>
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Time</p>
        <p style="margin: 0; font-size: 15px;">${time.toISOString()}</p>
      </div>
      <p style="color: #666; font-size: 12px; margin: 0;">
        If this wasn't you, change your PIN immediately.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || "noreply@oneflash.one",
      to,
      subject: "⚡ oneflash — New Login Detected",
      html,
    });
  } catch (error) {
    console.error("Failed to send login notification:", error);
  }
}
