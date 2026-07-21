export type SyncResult = {
  ok: boolean;
  notes: number;
  chunks: number;
  upserted: number;
  deleted?: number;
  durationMs?: number;
  error?: string;
};

export type SyncStatus = {
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastResult: SyncResult | null;
};

let running = false;
let lastStartedAt: string | null = null;
let lastFinishedAt: string | null = null;
let lastResult: SyncResult | null = null;

export function tryAcquireSyncLock(): boolean {
  if (running) return false;
  running = true;
  lastStartedAt = new Date().toISOString();
  return true;
}

export function releaseSyncLock(): void {
  running = false;
}

export function setLastResult(result: SyncResult): void {
  lastResult = result;
  lastFinishedAt = new Date().toISOString();
}

export function getSyncStatus(): SyncStatus {
  return {
    running,
    lastStartedAt,
    lastFinishedAt,
    lastResult,
  };
}
