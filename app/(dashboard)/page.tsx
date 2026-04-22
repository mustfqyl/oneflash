import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PinScreenWrapper from "./PinScreenWrapper";

export default async function DashboardPage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-subdomain");
  const trustedToken = headersList.get("x-trusted-token");

  // No subdomain = rendering main landing page instead
  if (!subdomain) {
    redirect("/landing"); // To be built if needed, or redirect to login
  }

  // If user has a valid trusted device cookie, bypass PIN
  if (trustedToken) {
    redirect("/files");
  }

  return (
    <main className="min-h-screen bg-black">
      <PinScreenWrapper subdomain={subdomain} />
    </main>
  );
}
