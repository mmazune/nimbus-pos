export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NETWORK_ERROR"
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
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text ? { message: text } : null;
  }

  return response.json();
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

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
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

  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
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
