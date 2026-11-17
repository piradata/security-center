"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import {
  clearLoginFailures,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

function clientKey(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || "unknown";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=missing");

  const requestHeaders = await headers();
  const key = clientKey(requestHeaders.get("x-forwarded-for"));
  if (isLoginThrottled(key)) redirect("/login?error=throttled");

  // redirect: false lets us distinguish a failed sign-in from a successful
  // one, so the failure counter is only cleared after a valid login.
  let result: unknown;
  try {
    result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      recordLoginFailure(key);
      redirect("/login?error=invalid");
    }
    throw error;
  }

  const url = typeof result === "string" ? result : "";
  if (!url || /[?&]error=/.test(url)) {
    recordLoginFailure(key);
    redirect("/login?error=invalid");
  }

  clearLoginFailures(key);
  redirect("/dashboard");
}
