import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { User, CloudAccount, AccessLog } from "@prisma/client";

type UserWithRelations = User & {
  cloudAccounts: CloudAccount[];
  accessLogs: AccessLog[];
};

export default async function AdminUsersPage() {
  const session = await getServerSession();
  
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    redirect("/files");
  }

  const users = await prisma.user.findMany({
    include: {
      cloudAccounts: true,
      accessLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              Admin Dashboard
            </h1>
            <p className="text-zinc-500 mt-2">Manage users and platform statistics.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-[#111] border border-zinc-800 rounded-xl px-6 py-4 text-center">
              <p className="text-zinc-500 text-sm font-medium mb-1">Total Users</p>
              <p className="text-3xl font-bold">{users.length}</p>
            </div>
            <div className="bg-[#111] border border-zinc-800 rounded-xl px-6 py-4 text-center">
              <p className="text-zinc-500 text-sm font-medium mb-1">Total Connections</p>
              <p className="text-3xl font-bold">
                {users.reduce((acc: number, user: UserWithRelations) => acc + user.cloudAccounts.length, 0)}
              </p>
            </div>
          </div>
        </header>

        <div className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#1a1a1a] border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase">User</th>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase">Subdomain</th>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase">Plan</th>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase">Connections</th>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase">Last Login</th>
                <th className="px-6 py-4 text-xs tracking-wider text-zinc-500 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((user: UserWithRelations) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-zinc-500 mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md text-sm font-medium border border-blue-500/20">
                      {user.username}.oneflash.co
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-zinc-300">{user.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {user.cloudAccounts.map((acc: CloudAccount) => (
                        <span key={acc.id} className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {acc.provider === 'GOOGLE_DRIVE' ? 'GD' : 'OD'}
                        </span>
                      ))}
                      {user.cloudAccounts.length === 0 && <span className="text-sm text-zinc-600">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
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
