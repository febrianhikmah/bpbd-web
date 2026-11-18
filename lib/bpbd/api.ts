import type { Store } from './model';
export type Snapshot = { store: Store | null; revision: number; userId: string | null };
export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/bpbd/${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-BPBD-Request': '1' },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new RequestError(response.status, result.error || 'Permintaan gagal. Coba kembali.');
  return result as T;
}
