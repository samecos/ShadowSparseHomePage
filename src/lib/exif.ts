export type PhotoExif = {
  /** 解析到的拍摄时间；读不到 EXIF 时退回文件的最后修改时间。 */
  date: string;
  /** 仅当时间确实来自 EXIF 时才有值。 */
  shotDate?: string;
  lat?: number;
  lng?: number;
  camera?: string;
};

type ParsedExif = {
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  GPSLatitude?: unknown;
  GPSLongitude?: unknown;
  GPSLatitudeRef?: unknown;
  GPSLongitudeRef?: unknown;
  Make?: unknown;
  Model?: unknown;
  LensModel?: unknown;
};

function toIsoDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized =
    typeof value === 'string' ? value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toDms(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null && 'length' in value) {
    return Array.from(value as ArrayLike<unknown>);
  }
  return undefined;
}

function toCoordinate(value: unknown, rawValue: unknown, reference: unknown, max: number) {
  const direct =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  const dms = Number.isFinite(direct)
    ? direct
    : (() => {
        const parts = toDms(rawValue);
        if (!parts || parts.length < 3) return undefined;
        const degrees = Number(parts[0]);
        const minutes = Number(parts[1]);
        const seconds = Number(parts[2]);
        if (![degrees, minutes, seconds].every(Number.isFinite)) return undefined;
        return Math.abs(degrees) + minutes / 60 + seconds / 3600;
      })();

  if (dms === undefined || Number.isFinite(dms) === false || Math.abs(dms) > max) {
    return undefined;
  }

  const hemisphere = typeof reference === 'string' ? reference.toUpperCase() : '';
  return hemisphere === 'S' || hemisphere === 'W' ? -Math.abs(dms) : dms;
}

/**
 * 从图片文件里读取拍摄时间、GPS 坐标和相机信息。
 * 解析失败或没有 EXIF 时退回文件的最后修改时间。
 */
export async function readPhotoExif(file: File): Promise<PhotoExif> {
  const fallback: PhotoExif = { date: new Date(file.lastModified).toISOString() };
  try {
    const exifr = (await import('exifr')).default;
    const parsed = (await exifr.parse(file, {
      // GPS coordinates are derived from the raw DMS tags. Keep both sets in
      // the pick list; selecting only latitude/longitude makes exifr omit the
      // derived values for some JPEGs (including iPhone exports).
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'Make',
        'Model',
        'LensModel',
        'latitude',
        'longitude',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef'
      ],
      gps: true
    })) as ParsedExif | undefined;
    if (!parsed) return fallback;

    const shotDate = toIsoDate(parsed.DateTimeOriginal) ?? toIsoDate(parsed.CreateDate);
    const clean = (value: unknown) =>
      typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
    const camera = [clean(parsed.Make), clean(parsed.Model)].filter(Boolean).join(' ') ||
      clean(parsed.LensModel) ||
      undefined;
    const lat = toCoordinate(parsed.latitude, parsed.GPSLatitude, parsed.GPSLatitudeRef, 90);
    const lng = toCoordinate(parsed.longitude, parsed.GPSLongitude, parsed.GPSLongitudeRef, 180);
    return {
      date: shotDate ?? fallback.date,
      shotDate,
      lat,
      lng,
      camera
    };
  } catch {
    return fallback;
  }
}
