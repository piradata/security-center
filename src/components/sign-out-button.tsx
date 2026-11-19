"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "mt-2 inline-flex items-center gap-1.5 text-left text-xs font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer",
        className,
      )}
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
