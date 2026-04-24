import { Suspense } from "react";
import { redirect } from "next/navigation";
import ConnectStorageDialog from "@/components/finder/ConnectStorageDialog";
import FinderWindow from "@/components/finder/FinderWindow";
import Sidebar from "@/components/finder/Sidebar";
import Toolbar from "@/components/finder/Toolbar";
import TabsBar from "@/components/finder/TabsBar";
import FileGrid from "@/components/finder/FileGrid";
import StatusBar from "@/components/finder/StatusBar";
import { CloudProvider } from "@/components/finder/CloudContext";
import { resolveServerAccess } from "@/lib/auth";

export default async function FilesPage() {
  const { access, subdomain } = await resolveServerAccess({
    allowTrustedDevice: true,
  });

  if (!access) {
    redirect(subdomain ? "/" : "/login");
  }

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-window text-foreground">Loading...</div>}>
      <CloudProvider>
        <FinderWindow>
          <Sidebar canAccessSettings={access.mode === "session"} />
          <div className="flex min-w-0 flex-1 flex-col bg-window-pane">
            <Toolbar />
            <TabsBar />
            <div className="flex-1 overflow-y-auto">
              <FileGrid />
            </div>
            <StatusBar />
          </div>
        </FinderWindow>
        <ConnectStorageDialog />
      </CloudProvider>
    </Suspense>
  );
}
