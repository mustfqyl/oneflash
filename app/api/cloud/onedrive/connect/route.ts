import { NextResponse } from "next/server";
import { getOneDriveAuthUrl } from "@/lib/onedrive";

export async function GET() {
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/cloud/onedrive/callback`;
  const authUrl = getOneDriveAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
