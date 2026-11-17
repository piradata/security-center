export type ScoreTone = "unknown" | "good" | "warn" | "bad";

export function scoreTone(value: number | null | undefined): ScoreTone {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "unknown";
  }
  if (value >= 90) return "good";
  if (value >= 70) return "warn";
  return "bad";
}

export const SCORE_WEIGHTS = [
  { label: "Critical", weight: 40 },
  { label: "High", weight: 20 },
  { label: "Medium", weight: 10 },
  { label: "Low", weight: 5 },
  { label: "Info", weight: 1 },
] as const;

export function scoreLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not scanned";
  }
  if (value >= 90) return "Good";
  if (value >= 70) return "Needs attention";
  return "Critical";
}
