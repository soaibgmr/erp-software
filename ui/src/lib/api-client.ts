// Typed fetch wrapper: adds clientid, bearer token and branch headers, unwraps the API envelope,
// and rotates the refresh token once on a 401.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";
const CLIENT_ID = (import.meta.env.VITE_CLIENT_ID as string | undefined) ?? "";

const TOKEN_KEY = "ami.token";
const REFRESH_KEY = "ami.refresh";
const BRANCH_KEY = "ami.branch";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> },
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fieldErrors(): Record<string, string> {
    const entries = Object.entries(this.details?.fieldErrors ?? {}).filter(([, v]) => v?.length);
    return Object.fromEntries(entries.map(([k, v]) => [k, v![0]!]));
  }
}

// Storage can be unavailable (private mode, blocked site data); fall back to memory.
const memory = new Map<string, string>();
const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      if (value === null) memory.delete(key);
      else memory.set(key, value);
    }
  },
};

export const session = {
  get token() {
    return storage.get(TOKEN_KEY);
  },
  get refreshToken() {
    return storage.get(REFRESH_KEY);
  },
  set(tokens: { token: string; refreshToken: string } | null) {
    storage.set(TOKEN_KEY, tokens?.token ?? null);
    storage.set(REFRESH_KEY, tokens?.refreshToken ?? null);
  },
  get branchId() {
    return storage.get(BRANCH_KEY);
  },
  set branchId(id: string | null) {
    storage.set(BRANCH_KEY, id);
  },
};

let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
  // Extra request headers, e.g. Idempotency-Key on the POS charge.
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

let refreshing: Promise<boolean> | null = null;

// One refresh at a time; concurrent 401s wait for the same rotation.
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = session.refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "content-type": "application/json", clientid: CLIENT_ID },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      session.set(json.data);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function raw(
  method: string,
  path: string,
  opts: RequestOptions = {},
  retried = false,
): Promise<{ data: unknown; meta?: unknown }> {
  const headers: Record<string, string> = { clientid: CLIENT_ID, ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const useAuth = opts.auth !== false;
  if (useAuth && session.token) headers.authorization = `Bearer ${session.token}`;
  if (session.branchId) headers["x-branch-id"] = session.branchId;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "The server didn't respond. Check the connection and try again.");
  }

  if (res.status === 401 && useAuth && !retried && session.refreshToken) {
    if (await refreshSession()) return raw(method, path, opts, true);
    session.set(null);
    onSessionExpired();
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const error = json?.error ?? {};
    throw new ApiError(
      res.status,
      error.code ?? "HTTP_ERROR",
      error.message ?? `Request failed (${res.status})`,
      error.details,
    );
  }
  return json;
}

// Downloads a file response (CSV, Excel, XML, JSON export) and hands it to the browser to save.
// Errors still come back as the JSON envelope and are thrown as ApiError.
async function download(path: string, query?: Query, retried = false): Promise<string> {
  const headers: Record<string, string> = { clientid: CLIENT_ID };
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  if (session.branchId) headers["x-branch-id"] = session.branchId;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { headers });
  } catch {
    throw new ApiError(0, "NETWORK", "The server didn't respond. Check the connection and try again.");
  }
  if (res.status === 401 && !retried && session.refreshToken) {
    if (await refreshSession()) return download(path, query, true);
    session.set(null);
    onSessionExpired();
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const error = json?.error ?? {};
    throw new ApiError(
      res.status,
      error.code ?? "HTTP_ERROR",
      error.message ?? `Download failed (${res.status})`,
      error.details,
    );
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "download";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export const api = {
  download,
  get: async <T>(path: string, query?: Query, signal?: AbortSignal) =>
    (await raw("GET", path, { query, signal })).data as T,
  list: async <T>(path: string, query?: Query, signal?: AbortSignal) => {
    const res = await raw("GET", path, { query, signal });
    return { data: res.data as T[], meta: res.meta as PaginationMeta } satisfies Paginated<T>;
  },
  post: async <T>(path: string, body?: unknown, opts?: { auth?: boolean; headers?: Record<string, string> }) =>
    (await raw("POST", path, { body: body ?? {}, ...opts })).data as T,
  patch: async <T>(path: string, body: unknown) => (await raw("PATCH", path, { body })).data as T,
  delete: async <T = null>(path: string) => (await raw("DELETE", path)).data as T,
};
