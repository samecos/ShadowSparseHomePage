import type { Photo } from './types';

export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isTrashed(photo: Photo) {
  return Boolean(photo.deletedAt);
}

/** 移除在回收站里超过保留期的照片记录（软删除过期）。 */
export function purgeExpiredTrash(items: Photo[], now = Date.now()): Photo[] {
  const cutoff = now - TRASH_RETENTION_DAYS * DAY_MS;
  return items.filter(
    (photo) => !photo.deletedAt || new Date(photo.deletedAt).getTime() > cutoff
  );
}

/** 站长可见全部（含回收站），访客只可见公开且未删除的。 */
export function visiblePhotos(items: Photo[], admin: boolean): Photo[] {
  const purged = purgeExpiredTrash(items);
  if (admin) return purged;
  return purged.filter((photo) => photo.visibility === 'public' && !photo.deletedAt);
}

export function sortPhotos(items: Photo[]): Photo[] {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface PhotoDayGroup {
  key: string;
  label: string;
  items: Photo[];
}

/** 按天分组（列表需已按新到旧排序），组标题附上统一的地点。 */
export function groupPhotosByDay(items: Photo[], formatDay: (value: string) => string): PhotoDayGroup[] {
  const groups: PhotoDayGroup[] = [];

  items.forEach((photo) => {
    const key = new Date(photo.date).getTime();
    const bucket = Number.isNaN(key) ? photo.date : photo.date.slice(0, 10);
    const existing = groups.find((group) => group.key === bucket);
    if (existing) {
      existing.items.push(photo);
      return;
    }
    groups.push({ key: bucket, label: formatDay(photo.date), items: [photo] });
  });

  groups.forEach((group) => {
    const locations = new Set(
      group.items.map((photo) => photo.locationName.trim()).filter(Boolean)
    );
    if (locations.size === 1) {
      group.label = `${group.label} · ${[...locations][0]}`;
    }
  });

  return groups;
}
