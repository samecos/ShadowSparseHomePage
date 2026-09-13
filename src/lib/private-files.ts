import { promises as fs } from 'node:fs';
import path from 'node:path';

const dataDir = process.env.HOMEPAGE_DATA_DIR
  ? path.resolve(process.env.HOMEPAGE_DATA_DIR)
  : path.join(process.cwd(), 'data');

const privateUploadDir = path.join(dataDir, 'private-uploads');

export async function ensurePrivateUploadDir() {
  await fs.mkdir(privateUploadDir, { recursive: true });
}

export function privateFilePath(storageKey: string) {
  const target = path.resolve(privateUploadDir, storageKey);
  const root = `${privateUploadDir}${path.sep}`;
  if (target.startsWith(root) === false) {
    throw new Error('非法的私有文件路径。');
  }
  return target;
}

export async function removePrivateFile(storageKey: string) {
  try {
    await fs.unlink(privateFilePath(storageKey));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') throw error;
  }
}
