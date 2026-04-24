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
    select: {
      expiresAt: true,
      user: {
        select: {
          username: true,
        },
      },
    },
  });

  if (!link || link.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
            Link Expired
          </h1>
          <p className="text-muted">This guest link is no longer valid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background p-4">
      <div className="mb-4 flex h-12 items-center justify-between rounded-xl border border-border bg-surface-soft px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
          <span className="text-sm font-medium">
            Guest Access ({link.user.username})
          </span>
        </div>
        <div className="text-xs font-medium text-muted">
          Read-only access
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FinderWindow>
          <div className="flex h-full w-full flex-col bg-window-pane">
            <div className="flex h-14 items-center border-b border-border bg-window-chrome px-4 text-sm font-semibold">
              Shared Files
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted">
              <svg className="h-16 w-16 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <p>Guest file browsing is not available yet.</p>
            </div>
          </div>
        </FinderWindow>
      </div>
    </div>
  );
}
