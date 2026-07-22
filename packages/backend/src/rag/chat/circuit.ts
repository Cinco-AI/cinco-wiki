const CIRCUIT_THRESHOLD = 5;
const COOLDOWN_MS = 60_000;

let llmFailures = 0;
let openedAt: number | null = null;
let halfOpenProbe = false;

export function isCircuitOpen(): boolean {
  if (llmFailures < CIRCUIT_THRESHOLD) return false;
  if (openedAt == null) {
    openedAt = Date.now();
    return true;
  }
  if (Date.now() - openedAt >= COOLDOWN_MS) {
    // Half-open: allow one probe through.
    if (!halfOpenProbe) {
      halfOpenProbe = true;
      return false;
    }
    return true;
  }
  return true;
}

export function recordLlmSuccess(): void {
  llmFailures = 0;
  openedAt = null;
  halfOpenProbe = false;
}

export function recordLlmFailure(): void {
  llmFailures += 1;
  if (llmFailures >= CIRCUIT_THRESHOLD) {
    openedAt = Date.now();
  }
  halfOpenProbe = false;
}

export function getLlmFailureCount(): number {
  return llmFailures;
}
