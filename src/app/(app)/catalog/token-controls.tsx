"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createService, rotateServiceToken } from "./actions";

const INITIAL_STATE = { token: null, serviceName: null, error: null };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function TokenResult({
  state,
}: {
  state: { token: string | null; serviceName: string | null; error: string | null };
}) {
  if (state.error) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (!state.token) return null;

  return (
    <div
      role="status"
      className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-medium">Copy the token for {state.serviceName} now.</p>
      <p className="mt-1">It cannot be shown again.</p>
      <code className="mt-2 block break-all rounded bg-white/70 p-2 font-mono text-xs dark:bg-black/30">
        {state.token}
      </code>
    </div>
  );
}

export function CreateServiceForm({ applicationId }: { applicationId: string }) {
  const [state, action] = useActionState(createService, INITIAL_STATE);

  return (
    <form action={action} className="mt-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <input type="hidden" name="applicationId" value={applicationId} />
      <h4 className="font-medium">Add service</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input
            required
            maxLength={120}
            name="name"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Slug</span>
          <input
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            name="slug"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
      </div>
      <div className="mt-3">
        <SubmitButton>Create service and token</SubmitButton>
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
      <SubmitButton>{hasToken ? "Rotate token" : "Create token"}</SubmitButton>
      <TokenResult state={state} />
    </form>
  );
}
