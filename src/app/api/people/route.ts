import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { listPeopleWithFaces } from '@/lib/people';

export async function GET(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  return ok({ items: await listPeopleWithFaces() });
}
