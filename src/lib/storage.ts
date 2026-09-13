import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type CollectionName =
  | 'posts'
  | 'map-stories'
  | 'works'
  | 'collectibles'
  | 'photos'
  | 'trips'
  | 'trip-attachments';

const defaultDataDir = path.join(process.cwd(), 'data');
const dataDir = process.env.HOMEPAGE_DATA_DIR
  ? path.resolve(process.env.HOMEPAGE_DATA_DIR)
  : defaultDataDir;

const fileNames: Record<CollectionName, string> = {
  posts: 'posts.json',
  'map-stories': 'map-stories.json',
  works: 'works.json',
  collectibles: 'collectibles.json',
  photos: 'photos.json',
  trips: 'trips.json',
  'trip-attachments': 'trip-attachments.json'
};

const queues = new Map<string, Promise<unknown>>();

function filePath(name: CollectionName) {
  return path.join(/* turbopackIgnore: true */ dataDir, fileNames[name]);
}

async function ensureDataDir() {
  await fs.mkdir(/* turbopackIgnore: true */ dataDir, { recursive: true });
}

async function readJsonFile<T>(target: string, fallback: T[]): Promise<T[]> {
  try {
    const raw = await fs.readFile(target, 'utf8');
    return JSON.parse(raw) as T[];
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return fallback;
    throw error;
  }
}

function uploadedPhotosPath() {
  return path.join(/* turbopackIgnore: true */ dataDir, 'uploads.json');
}

function isUploadedPhoto(value: unknown) {
  if (typeof value !== 'object' || value === null) return false;
  const url = (value as { url?: unknown }).url;
  return typeof url === 'string' && url.startsWith('/uploads/');
}

export async function readCollection<T>(name: CollectionName, fallback: T[] = []): Promise<T[]> {
  const stored = await readJsonFile(filePath(name), fallback);
  if (name !== 'photos') return stored;

  const uploaded = await readJsonFile<T>(uploadedPhotosPath(), []);
  return [...stored, ...uploaded];
}

async function writeJsonFile<T>(target: string, value: T[]) {
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
}

async function writeCollection<T>(name: CollectionName, value: T[]) {
  await ensureDataDir();

  if (name === 'photos') {
    const photos = value.filter((item) => !isUploadedPhoto(item));
    const uploadedPhotos = value.filter(isUploadedPhoto);
    await writeJsonFile(filePath(name), photos);
    await writeJsonFile(uploadedPhotosPath(), uploadedPhotos);
    return;
  }

  await writeJsonFile(filePath(name), value);
}

export async function mutateCollection<T, R>(
  name: CollectionName,
  mutator: (current: T[]) => R | Promise<R>
): Promise<R> {
  const key = name;
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.then(async () => {
    const current = await readCollection<T>(name, []);
    const result = await mutator(current);
    await writeCollection(name, current);
    return result;
  });
  queues.set(
    key,
    task.then(
      () => undefined,
      () => undefined
    )
  );
  return task;
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
