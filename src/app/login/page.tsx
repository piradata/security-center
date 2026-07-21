import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const params = await searchParams;
  const oidcConfigured = Boolean(
    process.env.AUTH_OIDC_ISSUER &&
      process.env.AUTH_OIDC_CLIENT_ID &&
      process.env.AUTH_OIDC_CLIENT_SECRET,
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Center</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your organization identity provider.
          </p>
        </div>

        {params.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            Sign-in failed ({params.error}). Check OIDC configuration.
          </p>
        ) : null}

        {oidcConfigured ? (
          <form
            action={async () => {
              "use server";
              await signIn("oidc", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Continue with OIDC
            </button>
          </form>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            OIDC is not configured. Set AUTH_OIDC_ISSUER, AUTH_OIDC_CLIENT_ID, and
            AUTH_OIDC_CLIENT_SECRET.
          </p>
        )}
      </div>
    </div>
  );
}
