import { prisma } from "@/lib/prisma";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  plan: string;
  createdAt: Date | string;
  cloudAccounts: Array<{
    id: string;
    provider: string;
  }>;
  accessLogs: Array<{
    createdAt: Date | string;
  }>;
};

export default async function AdminUsersPage() {
  const users = (await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      plan: true,
      createdAt: true,
      cloudAccounts: {
        select: {
          id: true,
          provider: true,
        },
      },
      accessLogs: {
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  })) as AdminUser[];

  return (
    <div className="min-h-screen bg-background p-8 font-sans text-foreground">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between motion-enter">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-muted">Manage users and platform statistics.</p>
          </div>
          
          <div className="flex gap-4 motion-stagger-children">
            <div className="rounded-xl border border-border-strong bg-surface px-6 py-4 text-center motion-hover-lift">
              <p className="mb-1 text-sm font-medium text-muted">Total Users</p>
              <p className="text-3xl font-bold">{users.length}</p>
            </div>
            <div className="rounded-xl border border-border-strong bg-surface px-6 py-4 text-center motion-hover-lift">
              <p className="mb-1 text-sm font-medium text-muted">Total Connections</p>
              <p className="text-3xl font-bold">
                {users.reduce((acc: number, user) => acc + user.cloudAccounts.length, 0)}
              </p>
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface motion-enter motion-enter-delay-2">
          <table className="w-full text-left">
            <thead className="border-b border-border-strong bg-surface-elevated">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">User</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">Subdomain</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">Plan</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">Connections</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">Last Login</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-strong motion-stagger-children">
              {users.map((user) => (
                <tr key={user.id} className="motion-list-row transition-colors hover:bg-hover">
                  <td className="px-6 py-4">
                    <div className="font-medium">{user.email}</div>
                    <div className="mt-1 text-xs text-muted">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md text-sm font-medium border border-blue-500/20">
                      {user.username}.oneflash.one
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-muted-foreground-strong">{user.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {user.cloudAccounts.map((acc) => (
                        <span key={acc.id} className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          {acc.provider === 'GOOGLE_DRIVE' ? 'GD' : 'OD'}
                        </span>
                      ))}
                      {user.cloudAccounts.length === 0 && <span className="text-sm text-muted">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {user.accessLogs[0]?.createdAt 
                      ? new Date(user.accessLogs[0].createdAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">
                      Suspend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
