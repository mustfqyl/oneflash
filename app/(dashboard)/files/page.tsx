import { Suspense } from "react";
import FinderWindow from "@/components/finder/FinderWindow";
import Sidebar from "@/components/finder/Sidebar";
import Toolbar from "@/components/finder/Toolbar";
import TabsBar from "@/components/finder/TabsBar";
import FileGrid from "@/components/finder/FileGrid";
import StatusBar from "@/components/finder/StatusBar";
import { CloudProvider } from "@/components/finder/CloudContext";

export default function FilesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#1c1c1e] text-white">Loading...</div>}>
      <CloudProvider>
        <FinderWindow>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e20]">
            <Toolbar />
            <TabsBar />
            <div className="flex-1 overflow-y-auto">
              <FileGrid />
            </div>
            <StatusBar />
          </div>
        </FinderWindow>
      </CloudProvider>
    </Suspense>
  );
}
