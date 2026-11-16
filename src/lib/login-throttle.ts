const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(key: string): number[] {
  const now = Date.now();
  const timestamps = (failures.get(key) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  if (timestamps.length === 0) failures.delete(key);
  else failures.set(key, timestamps);
  return timestamps;
}

export function isLoginThrottled(key: string): boolean {
  return recent(key).length >= MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const timestamps = recent(key);
  timestamps.push(Date.now());
  failures.set(key, timestamps);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

/** Tests only. */
export function resetLoginThrottle(): void {
  failures.clear();
}
