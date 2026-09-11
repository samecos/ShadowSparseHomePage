import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'hp_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return (
    process.env.HOMEPAGE_SESSION_SECRET ??
    process.env.HOMEPAGE_ADMIN_TOKEN ??
    'homepage-local-secret'
  );
}

function agentToken() {
  return process.env.HERMES_API_TOKEN ?? process.env.HOMEPAGE_AGENT_TOKEN ?? '';
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function createSessionToken() {
  const payload = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [time, nonce, signature] = parts;
  const payload = `${time}.${nonce}`;
  const expected = sign(payload);
  if (equal(signature, expected) === false) return false;
  const issuedAt = Number(time);
  if (Number.isFinite(issuedAt) === false) return false;
  return Date.now() - issuedAt < SESSION_MAX_AGE * 1000;
}

export function isAdminRequest(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function isAgentRequest(request: NextRequest) {
  const token = agentToken();
  if (token.length === 0) return false;
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ') === false) return false;
  return equal(header.slice('Bearer '.length).trim(), token);
}

export function isAuthorizedWrite(request: NextRequest) {
  return isAdminRequest(request) || isAgentRequest(request);
}

export function unauthorized() {
  return Response.json(
    { ok: false, error: '需要管理员会话或 Bearer Agent Token。' },
    { status: 401 }
  );
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE
  };
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.HOMEPAGE_ADMIN_TOKEN ?? '';
  if (expected.length === 0) return false;
  return equal(password, expected);
}

const MIN_ADMIN_SLUG_LENGTH = 8;

function cleanAdminSlug(value: string) {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function getAdminSlug() {
  return cleanAdminSlug(process.env.HOMEPAGE_ADMIN_SLUG ?? '');
}

export function verifyAdminSlug(candidate: string) {
  const expected = getAdminSlug();
  if (expected.length < MIN_ADMIN_SLUG_LENGTH) return false;
  if (typeof candidate !== 'string') return false;
  return equal(candidate, expected);
}
