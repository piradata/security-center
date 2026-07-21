"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IssueStatus,
  type IssueStatus as Status,
} from "@/generated/prisma/enums";

type User = { id: string; name: string | null; email: string };

export function IssueControls({
  issueId,
  initialStatus,
  initialAssigneeUserId,
  users,
}: {
  issueId: string;
  initialStatus: Status;
  initialAssigneeUserId: string | null;
  users: User[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [assigneeUserId, setAssigneeUserId] = useState(
    initialAssigneeUserId ?? "",
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const response = await fetch(`/api/v1/issues/${issueId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        assigneeUserId: assigneeUserId || null,
      }),
    });
    const result = await response.json();

    setSaving(false);
    setMessage(response.ok ? "Issue updated." : result.error ?? "Update failed.");
    if (response.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        >
          {Object.values(IssueStatus).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Assignee</span>
        <select
          value={assigneeUserId}
          onChange={(event) => setAssigneeUserId(event.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name ?? user.email}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
      </div>
    </form>
  );
}
