"use client";

import { useRouter } from "next/navigation";
import PinScreen from "@/components/pin/PinScreen";

export default function PinScreenWrapper({ subdomain }: { subdomain: string }) {
  const router = useRouter();

  return (
    <PinScreen
      subdomain={subdomain}
      onSuccess={() => router.push("/files")}
    />
  );
}
