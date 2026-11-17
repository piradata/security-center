"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SecHubLogo } from "@/components/sec-hub-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/catalog", label: "Catalog" },
  { href: "/issues", label: "Issues" },
  { href: "/gates", label: "Gates" },
  { href: "/exports", label: "Exports" },
  { href: "/settings", label: "Settings" },
] as const;

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 text-lg font-semibold tracking-tight"
    >
      <SecHubLogo className="h-6 w-6" />
      Security Center
    </Link>
  );
}

function SidebarContent({
  pathname,
  userEmail,
  onNavigate,
}: {
  pathname: string;
  userEmail?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <Brand />
        <p className="mt-0.5 text-xs text-zinc-500">ASPM-lite</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "min-h-10 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <p className="truncate text-xs text-zinc-500">{userEmail}</p>
        <SignOutButton />
      </div>
    </>
  );
}

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-200 bg-background px-4 py-3 lg:hidden dark:border-zinc-800">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="min-h-10 min-w-10 rounded-md border border-zinc-300 p-2 dark:border-zinc-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 lg:flex dark:border-zinc-800 dark:bg-zinc-950">
          <SidebarContent pathname={pathname} userEmail={userEmail} />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-zinc-50 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <SidebarContent
              pathname={pathname}
              userEmail={userEmail}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
