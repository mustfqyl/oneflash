import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-drive";

export async function GET() {
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/cloud/google/callback`;
  const authUrl = getGoogleAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
