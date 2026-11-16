import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <AppShell userEmail={session?.user?.email ?? null}>{children}</AppShell>
  );
}
