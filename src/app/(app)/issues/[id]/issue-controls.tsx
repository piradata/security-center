"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
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
      setIsSuccess(response.ok);
      setMessage(
        response.ok
          ? "Status and assignee saved."
          : (result.error ?? "Update failed."),
      );
      if (response.ok) router.refresh();
    } catch {
      setSaving(false);
      setIsSuccess(false);
      setMessage("Network error occurred.");
    }
  }

  const selectStyle =
    "w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-11";

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block font-semibold text-zinc-800 dark:text-zinc-200">
            Triage Status
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
            className={selectStyle}
          >
            {Object.values(IssueStatus).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ").toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block font-semibold text-zinc-800 dark:text-zinc-200">
            Assigned Owner
          </span>
          <select
            value={assigneeUserId}
            onChange={(event) => setAssigneeUserId(event.target.value)}
            className={selectStyle}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ? `${user.name} (${user.email})` : user.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer w-full sm:w-auto"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving Changes…" : "Update Finding"}
        </button>

        {message && (
          <p
            role="status"
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              isSuccess
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isSuccess && <Check className="h-3.5 w-3.5" />}
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
