export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export function withCors(headers: Record<string, string> = {}) {
  return { ...CORS_HEADERS, ...headers };
}

export function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: withCors({ "content-type": "application/json" }),
  });
}

export function text(body: string, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    status,
    headers: withCors({ "content-type": contentType }),
  });
}

export function error(status: number, msg: string) {
  return json({ error: msg }, status);
}

export function preflight() {
  return new Response(null, { status: 204, headers: withCors() });
}

/**
 * Throwable API error that keeps a safe code and an optional public payload.
 * Never include stack traces, SQL, or raw row data in `payload`.
 */
export class HttpError extends Error {
  status: number;
  code: string;
  payload?: Record<string, unknown>;

  constructor(status: number, code: string, payload?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) {
    return json({ error: e.code, ...(e.payload ?? {}) }, e.status);
  }
  if (e instanceof Error) {
    if (e.message === "unauthorized") return error(401, "unauthorized");
    if (e.message === "forbidden") return error(403, "forbidden");
    if (e.message === "not_found") return error(404, "not_found");
  }
  return error(500, "internal_error");
}
