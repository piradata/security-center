"use client";

import { AlertTriangle, Key, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CopyButton } from "@/components/copy-button";
import { createService, rotateServiceToken } from "./actions";

const INITIAL_STATE = { token: null, serviceName: null, error: null };

function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer ${
        variant === "primary"
          ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          : "border border-zinc-300 bg-background text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending ? "Saving…" : children}
    </button>
  );
}

function TokenResult({
  state,
}: {
  state: {
    token: string | null;
    serviceName: string | null;
    error: string | null;
  };
}) {
  if (state.error) {
    return (
      <div
        role="alert"
        className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <p className="font-semibold">{state.error}</p>
      </div>
    );
  }
  if (!state.token) return null;

  return (
    <div
      role="status"
      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Copy token for {state.serviceName} now</span>
      </div>
      <p className="mt-1 text-[11px] text-amber-800/90 dark:text-amber-300/80">
        This secret is only shown once and cannot be recovered later.
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <code className="block flex-1 break-all rounded-md bg-white/80 p-2 font-mono text-xs text-zinc-900 dark:bg-black/40 dark:text-zinc-100 border border-amber-200 dark:border-amber-900">
          {state.token}
        </code>
        <CopyButton
          text={state.token}
          label="Copy Token"
          variant="button"
          className="shrink-0"
        />
      </div>
    </div>
  );
}

export function CreateServiceForm({
  applicationId,
}: {
  applicationId: string;
}) {
  const [state, action] = useActionState(createService, INITIAL_STATE);

  return (
    <form
      action={action}
      className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Register New Service
      </h4>
      <p className="mt-0.5 text-xs text-zinc-500">
        Creates a service entry and generates a secure CI bearer token.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
            Service Name
          </span>
          <input
            required
            maxLength={120}
            name="name"
            placeholder="e.g. auth-api"
            className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-10"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
            Slug (URL path safe)
          </span>
          <input
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            name="slug"
            placeholder="e.g. auth-api"
            className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-10"
          />
        </label>
      </div>
      <div className="mt-3">
        <SubmitButton>Create Service & Token</SubmitButton>
      </div>
      <TokenResult state={state} />
    </form>
  );
}

export function RotateTokenForm({
  serviceId,
  hasToken,
}: {
  serviceId: string;
  hasToken: boolean;
}) {
  const [state, action] = useActionState(
    rotateServiceToken.bind(null, serviceId),
    INITIAL_STATE,
  );

  return (
    <form action={action}>
      <SubmitButton variant={hasToken ? "secondary" : "primary"}>
        <Key className="h-3 w-3 mr-1" />
        {hasToken ? "Rotate Token" : "Generate Token"}
      </SubmitButton>
      <TokenResult state={state} />
    </form>
  );
}
