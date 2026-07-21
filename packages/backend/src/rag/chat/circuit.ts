let llmFailures = 0;
const CIRCUIT_THRESHOLD = 5;

export function isCircuitOpen(): boolean {
  return llmFailures >= CIRCUIT_THRESHOLD;
}

export function recordLlmSuccess(): void {
  llmFailures = 0;
}

export function recordLlmFailure(): void {
  llmFailures += 1;
}

export function getLlmFailureCount(): number {
  return llmFailures;
}
