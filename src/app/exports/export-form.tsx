"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

export function ExportForm({
  applications,
  services,
  tools,
  users,
  hasActiveJobs,
}: {
  applications: Option[];
  services: (Option & { application: { name: string } })[];
  tools: Option[];
  users: (Option & { email: string })[];
  hasActiveJobs: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [hasActiveJobs, router]);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setMessage("");
    const assignee = String(formData.get("assignee") ?? "");
    const filters = Object.fromEntries(
      ["appId", "serviceId", "toolId", "severity", "status"]
        .map((key) => [key, String(formData.get(key) ?? "")])
        .filter(([, value]) => value),
    ) as Record<string, string | boolean>;
    if (assignee === "unassigned") filters.unassigned = true;
    else if (assignee) filters.assigneeUserId = assignee;

    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: formData.get("format"), filters }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not create export");
      setMessage(`Export ${result.id} queued.`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create export",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      action={submit}
      className="grid gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Format">
          <select name="format" className={selectClass}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <Field label="Application">
          <select name="appId" className={selectClass}>
            <option value="">All applications</option>
            {applications.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select name="serviceId" className={selectClass}>
            <option value="">All services</option>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.application.name} / {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tool">
          <select name="toolId" className={selectClass}>
            <option value="">All tools</option>
            {tools.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Severity">
          <select name="severity" className={selectClass}>
            <option value="">All severities</option>
            {["critical", "high", "medium", "low", "info"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className={selectClass}>
            <option value="">All statuses</option>
            {["open", "in_progress", "resolved", "absent", "suppressed"].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Assignee">
          <select name="assignee" className={selectClass}>
            <option value="">Any assignee</option>
            <option value="unassigned">Unassigned</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.email}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Queueing…" : "Create export"}
        </Button>
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
      </div>
    </form>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
