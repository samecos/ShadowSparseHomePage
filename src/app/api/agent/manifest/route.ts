import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { createHomepageManifest } from '@/lib/manifest';

export async function GET(request: NextRequest) {
  return ok(createHomepageManifest(new URL(request.url).origin));
}
