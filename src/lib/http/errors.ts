import { NextResponse } from "next/server";

type ErrorBody =
  | { error: "UNAUTHORIZED"; message?: string }
  | { error: "FORBIDDEN"; message?: string }
  | { error: "BAD_REQUEST"; message?: string };

function jsonError(status: number, body: ErrorBody) {
  // Ensure `message` is omitted when not provided (stable shape for clients).
  const payload: Record<string, unknown> = { error: body.error };
  if (body.message && body.message.trim()) payload.message = body.message;
  return NextResponse.json(payload, { status });
}

export function unauthorized(message?: string) {
  return jsonError(401, { error: "UNAUTHORIZED", message });
}

export function forbidden(message?: string) {
  return jsonError(403, { error: "FORBIDDEN", message });
}

export function badRequest(message?: string) {
  return jsonError(400, { error: "BAD_REQUEST", message });
}

