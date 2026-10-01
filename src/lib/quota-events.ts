/**
 * A tiny event channel: api.ts calls openQuotaModal() when the backend answers
 * QUOTA_PAUSED; the QuotaModal (mounted once in the app shell) listens.
 */
type Listener = (details: unknown) => void;

const listeners = new Set<Listener>();

export function openQuotaModal(details: unknown): void {
  for (const listener of listeners) listener(details);
}

export function onQuotaModal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
