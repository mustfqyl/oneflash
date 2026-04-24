import { redirect } from "next/navigation";
import SettingsShell from "./SettingsShell";
import { resolveServerAccess } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { access, subdomain } = await resolveServerAccess({
    allowTrustedDevice: false,
  });

  if (!access) {
    redirect(subdomain ? "/" : "/login");
  }

  return <SettingsShell>{children}</SettingsShell>;
}
