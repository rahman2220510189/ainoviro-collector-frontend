/**
 * The ONLY place axios is configured (spec §3). Every request of the app goes through
 * this instance:
 *  - baseURL from NEXT_PUBLIC_API_URL (baked in at build time),
 *  - cookies sent with every request (the login session is an httpOnly cookie),
 *  - the CSRF header the backend requires on every state-changing request,
 *  - 401 -> back to /login, QUOTA_PAUSED -> quota modal, other errors -> one toast.
 */
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { openQuotaModal } from './quota-events';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** true = the caller shows the error itself; no automatic toast. */
    silent?: boolean;
  }
}

/** Error body of every backend error: { error: { code, message, details } }. */
export interface ApiErrorBody {
  error: { code: string; message: string; details: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 60_000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

/** A blob response (CSV download) carries its error body as a Blob: read it as JSON. */
async function readErrorBody(data: unknown): Promise<Partial<ApiErrorBody> | null> {
  try {
    if (typeof Blob !== 'undefined' && data instanceof Blob) return JSON.parse(await data.text());
    if (data && typeof data === 'object') return data as Partial<ApiErrorBody>;
  } catch {
    // Not JSON: fall through.
  }
  return null;
}

function goToLogin(): void {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/login')) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // A full page load on purpose: it drops every cached query of the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`);
}

api.interceptors.response.use(
  (response) => response,
  async (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const body = await readErrorBody(err.response?.data);
    const code = body?.error?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR');
    const message =
      body?.error?.message ??
      (status === 0
        ? 'Cannot reach the server. Is the backend running?'
        : `Request failed (${status})`);
    const apiError = new ApiError(status, code, message, body?.error?.details ?? null);

    const isLoginCall = err.config?.url?.includes('/auth/login') ?? false;
    const isMeCall = err.config?.url?.includes('/auth/me') ?? false;
    if (status === 401 && !isLoginCall) {
      // Session missing or expired: the page cannot work without login.
      if (!isMeCall) toast.error('Your session has ended. Please log in again.');
      goToLogin();
    } else if (code === 'QUOTA_PAUSED') {
      openQuotaModal(apiError.details);
    } else if (!err.config?.silent) {
      toast.error(message, { id: `${code}:${message}` });
    }
    return Promise.reject(apiError);
  },
);

/**
 * Downloads a file in one click (no dialog): the browser saves it under the name the
 * backend sends in Content-Disposition. Returns the response headers.
 */
export async function downloadFile(
  url: string,
  params?: Record<string, unknown>,
): Promise<Record<string, string>> {
  const response = await api.get<Blob>(url, { params, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'download.csv';
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return response.headers as Record<string, string>;
}
