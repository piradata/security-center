import { redirect } from "next/navigation";
import { SecHubLogo } from "@/components/sec-hub-logo";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Invalid email or password.",
  missing: "Enter your email and password.",
  throttled: "Too many failed attempts. Wait 15 minutes and try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  const params = await searchParams;
  const error = params.error
    ? (ERRORS[params.error] ?? "Sign-in failed.")
    : null;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <SecHubLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Security Center
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Sign in with your account.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form action={login} className="space-y-4">
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
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
