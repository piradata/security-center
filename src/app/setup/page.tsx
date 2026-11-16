import { redirect } from "next/navigation";
import { SecHubLogo } from "@/components/sec-hub-logo";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setupAdmin } from "./actions";

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  name: "Name is too long.",
  password: "Use at least 8 characters.",
  match: "The two passwords do not match.",
  exists: "This instance is already set up. Sign in instead.",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  const params = await searchParams;
  const error = params.error ? (ERRORS[params.error] ?? "Setup failed.") : null;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <SecHubLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Claim Security Center
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              First access. The account you create now becomes the admin.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form action={setupAdmin} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium">
            Display name
            <input
              name="name"
              type="text"
              autoComplete="name"
              maxLength={120}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <p className="text-xs text-zinc-500">
            At least 8 characters. There is no reset email; an admin can reset
            passwords from Settings.
          </p>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Create admin and sign in
          </button>
        </form>
      </div>
    </div>
  );
}
