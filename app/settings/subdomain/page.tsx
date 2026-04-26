import SubdomainSettingsClient from "./SubdomainSettingsClient";
import { getRootDomain } from "@/lib/subdomain";

export default function SubdomainSettingsPage() {
  return <SubdomainSettingsClient rootDomain={getRootDomain()} />;
}
