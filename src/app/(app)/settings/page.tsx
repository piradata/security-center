export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Users and auth notes. OIDC is configured via environment variables;
        bootstrap admin uses BOOTSTRAP_ADMIN_EMAIL.
      </p>
    </div>
  );
}
