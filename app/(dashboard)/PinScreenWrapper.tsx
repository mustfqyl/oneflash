"use client";

import { useRouter } from "next/navigation";
import PinScreen from "@/components/pin/PinScreen";

export default function PinScreenWrapper({
  subdomain,
  rootDomain,
}: {
  subdomain: string;
  rootDomain: string;
}) {
  const router = useRouter();

  return (
    <PinScreen
      subdomain={subdomain}
      rootDomain={rootDomain}
      onSuccess={() => router.push("/files")}
    />
  );
}
