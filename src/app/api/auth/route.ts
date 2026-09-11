import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import {
  createSessionToken,
  isAdminRequest,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyAdminPassword,
  verifyAdminSlug
} from '@/lib/auth';

export async function GET(request: NextRequest) {
  return ok({ admin: isAdminRequest(request) });
}

export async function POST(request: NextRequest) {
  let password = '';
  let entryKey = '';
  try {
    const body = (await request.json()) as { password?: unknown; entry?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
    entryKey = typeof body.entry === 'string' ? body.entry : '';
  } catch {
    return fail('请求格式不正确。');
  }

  // 口令和隐藏入口同时正确才允许建立会话；
  // 即使有人找到这个 API，也无法只凭暴力破解口令登录。
  if (verifyAdminPassword(password) === false || verifyAdminSlug(entryKey) === false) {
    return fail('口令不正确。', 401);
  }

  const response = ok({ admin: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  return response;
}

export async function DELETE() {
  const response = ok({ admin: false });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
