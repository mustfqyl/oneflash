"use client";

import { useEffect } from "react";
import {
  CLOUD_PREVIEW_SW_PATH,
  CLOUD_PREVIEW_SW_READY_EVENT,
} from "@/lib/cloud-preview";

declare global {
  interface Window {
    __oneflashCloudPreviewWorkerReady__?: boolean;
  }
}

function markCloudPreviewWorkerReady() {
  if (typeof window === "undefined" || window.__oneflashCloudPreviewWorkerReady__) {
    return;
  }

  window.__oneflashCloudPreviewWorkerReady__ = true;
  window.dispatchEvent(new Event(CLOUD_PREVIEW_SW_READY_EVENT));
}

export default function CloudPreviewServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let controllerChangeHandler: (() => void) | null = null;

    const handleReady = () => {
      if (!cancelled && navigator.serviceWorker.controller) {
        markCloudPreviewWorkerReady();
      }
    };

    const register = async () => {
      try {
        await navigator.serviceWorker.register(CLOUD_PREVIEW_SW_PATH, {
          scope: "/",
          updateViaCache: "none",
        });

        if (navigator.serviceWorker.controller) {
          handleReady();
          return;
        }

        controllerChangeHandler = () => {
          handleReady();
        };

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          controllerChangeHandler
        );

        await navigator.serviceWorker.ready;
        handleReady();
      } catch (error) {
        console.error("Cloud preview worker registration failed:", error);
      }
    };

    void register();

    return () => {
      cancelled = true;
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          controllerChangeHandler
        );
      }
    };
  }, []);

  return null;
}
