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
  created: "User created.",
  reset: "Password reset.",
  password: "Password changed.",
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Accounts use email and password. The first account created at setup is
          the admin; admins can add members and reset passwords here.
        </p>
      </div>

      {error ? (
        <p className="max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="max-w-xl rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <section className="max-w-xl space-y-4">
        <h2 className="text-lg font-semibold">Change your password</h2>
        <form action={changeOwnPassword} className="space-y-4">
          <label className="block text-sm font-medium">
            Current password
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            New password
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
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Update password
          </button>
        </form>
      </section>

      {isAdmin ? (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Users</h2>
            <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Reset password</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2">{user.email}</td>
                      <td className="px-3 py-2">{user.name ?? "—"}</td>
                      <td className="px-3 py-2">{user.role}</td>
                      <td className="px-3 py-2">
                        {user.createdAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">
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
                            className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
          </section>

          <section className="max-w-xl space-y-4">
            <h2 className="text-lg font-semibold">Add a user</h2>
            <form action={createUser} className="space-y-4">
              <label className="block text-sm font-medium">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium">
                Display name
                <input
                  name="name"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium">
                Temporary password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium">
                Role
                <select
                  name="role"
                  className={inputClass}
                  defaultValue="member"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Create user
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
