export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "SHIFT_NOT_OPEN"
  | "ORDER_NOT_OWNED_BY_WAITER"
  | "ORDER_TRANSITION_NOT_WAITER_SAFE"
  | string;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  branchId?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError() {
    return this.status === 401 || this.code === "UNAUTHORIZED";
  }

  get isForbidden() {
    return this.status === 403 || this.code === "FORBIDDEN";
  }
}

export function shouldRetryApiRequest(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

function normalizeApiBaseUrl(value: string | undefined) {
  const withoutTrailingSlash = (value || "http://localhost:3001").trim().replace(/\/+$/, "");
  return withoutTrailingSlash.replace(/\/api$/i, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  return `HTTP_${status}`;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;

  if (!contentType.includes("application/json")) {
    return { message: text };
  }

  return JSON.parse(text);
}

function buildApiError(response: Response, payload: unknown) {
  const body = payload as {
    message?: string | string[];
    error?: { code?: string; message?: string; requestId?: string } | string;
    statusCode?: number;
  } | null;

  const nestedError = typeof body?.error === "object" ? body.error : null;
  const rawMessage = nestedError?.message || body?.message || response.statusText;
  const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : rawMessage;
  const code = nestedError?.code || codeFromStatus(response.status);

  return new ApiError({
    status: response.status,
    code,
    message: message || "Request failed",
    details: payload,
  });
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs);

  function abortFromExternal() {
    controller.abort(externalSignal?.reason || "aborted");
  }

  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-Id": createRequestId(),
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.branchId) {
    headers["X-Branch-Id"] = options.branchId;
  }

  const url = `${API_BASE_URL}${normalizePath(path)}`;
  let response: Response;
  const timeoutMs = options.timeoutMs ?? 30_000;

  try {
    response = await fetchWithTimeout(url, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }, timeoutMs, options.signal);
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    if (aborted) {
      throw new ApiError({
        status: 0,
        code: "REQUEST_TIMEOUT",
        message: `Nimbus API did not respond within ${Math.round(timeoutMs / 1000)} seconds. Retry when the connection is stable.`,
        details: { url },
      });
    }

    const webOrigin = typeof window === "undefined" ? "this app" : window.location.origin;
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: `Cannot reach Nimbus API at ${API_BASE_URL}. Check that the API is running and that CORS allows ${webOrigin}.`,
      details: { url, cause: error instanceof Error ? error.message : String(error) },
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw buildApiError(response, payload);
  }

  return payload as T;
}
