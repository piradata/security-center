"use client";

import {
  Boxes,
  Download,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SecHubLogo } from "@/components/sec-hub-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/catalog", label: "Catalogue", icon: Boxes },
  { href: "/issues", label: "Issues", icon: ShieldAlert },
  { href: "/gates", label: "Gates", icon: ShieldCheck },
  { href: "/exports", label: "Exports", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
    >
      <SecHubLogo className="h-6 w-6 shrink-0" />
      <span className="truncate">Security Center</span>
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
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="border-b border-zinc-200/80 px-4 py-4.5 dark:border-zinc-800">
          <Brand onNavigate={onNavigate} />
          <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            ASPM & Software Catalog
          </p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-white dark:text-zinc-900"
                      : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {userEmail ? (
              userEmail.slice(0, 2).toUpperCase()
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <SignOutButton className="mt-2.5" />
      </div>
    </div>
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

  // Close drawer on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    if (drawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [drawerOpen]);

  // Determine current active section title for mobile header
  const currentNav = NAV.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background antialiased selection:bg-zinc-200 selection:text-zinc-900 dark:selection:bg-zinc-800 dark:selection:text-zinc-100">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-background/95 px-4 backdrop-blur-md lg:hidden dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <Brand />
          {currentNav && (
            <span className="hidden sm:inline-block text-xs font-medium text-zinc-400">
              / {currentNav.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-400 cursor-pointer"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-zinc-200/80 bg-zinc-50/70 lg:block dark:border-zinc-800 dark:bg-zinc-950">
          <div className="sticky top-0 h-screen overflow-hidden">
            <SidebarContent pathname={pathname} userEmail={userEmail} />
          </div>
        </aside>

        {/* Content Area */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Modal */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          {/* Backdrop with fade blur */}
          <button
            type="button"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation overlay"
          />

          {/* Drawer Pane with slide-in */}
          <aside className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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
