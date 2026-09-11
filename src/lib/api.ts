import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { valid: false as const, error: '请求体不是合法 JSON。' };
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success === false) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('；');
    return { valid: false as const, error: message };
  }

  return { valid: true as const, data: parsed.data };
}

export function parseQuery(request: Request) {
  return new URL(request.url).searchParams;
}
