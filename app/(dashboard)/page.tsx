import { redirect } from "next/navigation";
import PinScreenWrapper from "./PinScreenWrapper";
import { resolveServerAccess } from "@/lib/auth";
import { getRootDomain } from "@/lib/subdomain";

export default async function DashboardPage() {
  const { access, subdomain } = await resolveServerAccess({
    allowTrustedDevice: true,
  });
  const rootDomain = getRootDomain();

  if (!subdomain) {
    redirect("/");
  }

  if (access) {
    redirect("/files");
  }

  return (
    <main className="min-h-screen bg-background">
      <PinScreenWrapper subdomain={subdomain} rootDomain={rootDomain} />
    </main>
  );
}
