import { prisma } from "@/lib/prisma";
import FinderWindow from "@/components/finder/FinderWindow";

export default async function GuestAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  
  const link = await prisma.guestLink.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!link || link.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
            Link Expired
          </h1>
          <p className="text-zinc-500">This guest link is no longer valid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 px-4 h-12 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
          <span className="text-sm font-medium text-white">
            Guest Access ({link.user.username})
          </span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">
          Read-only access
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FinderWindow>
          <div className="w-full h-full flex flex-col bg-[#1e1e20]">
            <div className="h-14 border-b border-zinc-700/50 flex items-center px-4 bg-[#232325]/50 backdrop-blur-md text-sm font-semibold text-white">
              Shared Files
            </div>
            <div className="flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4">
              <svg className="w-16 h-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <p>Files will appear here once implementation is finalized.</p>
            </div>
          </div>
        </FinderWindow>
      </div>
    </div>
  );
}
