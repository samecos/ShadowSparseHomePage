import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';

const MAX_SIZE = 8 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf'
};

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const form = await request.formData();
  const file = form.get('file');

  if ((file instanceof File) === false) {
    return fail('请上传一个文件。');
  }

  if (file.size > MAX_SIZE) {
    return fail('文件不能超过 8MB。', 413);
  }

  const extension = extensions[file.type];
  if (!extension) {
    return fail('暂不支持这种文件格式。', 415);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), bytes);

  return ok({ url: `/uploads/${filename}`, name: file.name, size: file.size, type: file.type });
}
