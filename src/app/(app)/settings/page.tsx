import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changeOwnPassword, createUser, resetUserPassword } from "./actions";

const ERRORS: Record<string, string> = {
  forbidden: "Only admins can manage users.",
  email: "Enter a valid email address.",
  name: "Name is too long.",
  password: "Use at least 8 characters.",
  duplicate: "A user with that email already exists.",
  "missing-user": "That user no longer exists.",
  current: "Current password is incorrect.",
};

const NOTICES: Record<string, string> = {
  created: "User created successfully.",
  reset: "Password has been reset.",
  password: "Your password was updated.",
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-11";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const params = await searchParams;
  const error = params.error
    ? (ERRORS[params.error] ?? "Something went wrong.")
    : null;
  const notice = params.ok ? (NOTICES[params.ok] ?? "Saved.") : null;

  const users = isAdmin
    ? await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Settings & Access
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage your account credentials, security access, and system users.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      {/* Change password */}
      <section className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 sm:text-lg">
            Change Your Password
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Ensure your account is protected with a strong password.
          </p>
        </div>

        <form action={changeOwnPassword} className="space-y-4 max-w-lg">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Current Password
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            New Password (minimum 8 characters)
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer w-full sm:w-auto"
          >
            Update Password
          </button>
        </form>
      </section>

      {/* Admin User Management */}
      {isAdmin ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 sm:text-lg">
                User Management ({users.length})
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Admins can create accounts and reset user passwords.
              </p>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Reset Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 text-xs">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {user.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={user.role === "admin" ? "danger" : "neutral"}
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {user.createdAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <form
                          action={resetUserPassword}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            required
                            placeholder="New password"
                            className="w-36 rounded-md border border-zinc-300 bg-background px-2.5 py-1 text-xs outline-hidden focus:border-zinc-500 dark:border-zinc-700 min-h-8"
                          />
                          <button
                            type="submit"
                            className="inline-flex min-h-8 items-center rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            Reset
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< sm) */}
            <div className="sm:hidden space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                        {user.email}
                      </p>
                      {user.name && (
                        <p className="text-[11px] text-zinc-500">{user.name}</p>
                      )}
                    </div>
                    <Badge
                      variant={user.role === "admin" ? "danger" : "neutral"}
                    >
                      {user.role}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                    <p className="text-[11px] text-zinc-500 mb-1.5 font-medium">
                      Reset Password:
                    </p>
                    <form
                      action={resetUserPassword}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        name="password"
                        type="password"
                        minLength={8}
                        required
                        placeholder="New password"
                        className="flex-1 rounded-lg border border-zinc-300 bg-background px-3 py-1.5 text-xs outline-hidden focus:border-zinc-500 dark:border-zinc-700 min-h-10"
                      />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Reset
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 sm:text-lg">
                Create New User
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Grant access to new team members.
              </p>
            </div>

            <form action={createUser} className="space-y-4 max-w-lg">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Email Address
                <input
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  placeholder="developer@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Display Name (Optional)
                <input
                  name="name"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  placeholder="Jane Doe"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Initial Password (minimum 8 characters)
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Role
                <select
                  name="role"
                  className={inputClass}
                  defaultValue="member"
                >
                  <option value="member">member (read and triage)</option>
                  <option value="admin">
                    admin (manage users and settings)
                  </option>
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer w-full sm:w-auto"
              >
                Create User
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
