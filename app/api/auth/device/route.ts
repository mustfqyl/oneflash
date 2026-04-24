import { NextRequest, NextResponse } from "next/server";
import {
  clearTrustedDeviceCookie,
  revokeTrustedDeviceToken,
} from "@/lib/auth";
import { ensureTrustedOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  const trustedOriginError = ensureTrustedOrigin(req);
  if (trustedOriginError) {
    return trustedOriginError;
  }

  const trustedDeviceToken = req.cookies.get("trusted_device")?.value;

  await revokeTrustedDeviceToken(trustedDeviceToken);

  return clearTrustedDeviceCookie(NextResponse.json({ success: true }));
}
