import { z } from 'zod';

const trimmed = z.string().trim();

export const postCreateSchema = z.object({
  content: trimmed.min(1, '写点什么吧。').max(2000),
  mood: trimmed.max(20).optional(),
  images: z.array(z.string().trim().min(1)).max(9).optional().default([]),
  location: trimmed.max(80).optional(),
  visibility: z.enum(['public', 'private']).optional().default('public'),
  pinned: z.boolean().optional().default(false)
});

export const postPatchSchema = z.object({
  content: trimmed.min(1, '写点什么吧。').max(2000).optional(),
  mood: trimmed.max(20).optional(),
  images: z.array(z.string().trim().min(1)).max(9).optional(),
  location: trimmed.max(80).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  pinned: z.boolean().optional()
});

export const mapPhotoSchema = z.object({
  id: z.string().trim().min(1),
  url: z.string().trim().min(1),
  caption: trimmed.max(120).optional().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
});

export const mapStoryCreateSchema = z.object({
  title: trimmed.min(1).max(80),
  note: trimmed.max(2000).optional().default(''),
  date: trimmed.min(4).max(30),
  locationName: trimmed.max(80).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional().default([]),
  photos: z.array(mapPhotoSchema).min(1).max(24)
});

export const mapStoryPatchSchema = z.object({
  title: trimmed.min(1).max(80).optional(),
  note: trimmed.max(2000).optional(),
  date: trimmed.min(4).max(30).optional(),
  locationName: trimmed.max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
  photos: z.array(mapPhotoSchema).min(1).max(24).optional(),
  photo: z
    .object({
      id: z.string().trim().min(1),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180)
    })
    .optional()
});

const optionalUrl = z
  .union([z.string().trim().url(), z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

export const collectibleCreateSchema = z.object({
  title: trimmed.min(1).max(140),
  type: z.enum(['link', 'image', 'quote', 'moment', 'file']),
  url: optionalUrl,
  image: z.string().trim().min(1).optional(),
  quote: trimmed.max(2000).optional(),
  description: trimmed.max(3000).optional(),
  agentSummary: trimmed.max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional().default([]),
  source: trimmed.max(120).optional(),
  collectedBy: z.enum(['me', 'hermes', 'unknown']).optional().default('hermes'),
  status: z.enum(['inbox', 'curated', 'archived']).optional().default('inbox'),
  featured: z.boolean().optional().default(false)
});

export const collectiblePatchSchema = z.object({
  title: trimmed.min(1).max(140).optional(),
  type: z.enum(['link', 'image', 'quote', 'moment', 'file']).optional(),
  url: optionalUrl,
  image: z.string().trim().min(1).optional(),
  quote: trimmed.max(2000).optional(),
  description: trimmed.max(3000).optional(),
  agentSummary: trimmed.max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
  source: trimmed.max(120).optional(),
  collectedBy: z.enum(['me', 'hermes', 'unknown']).optional(),
  status: z.enum(['inbox', 'curated', 'archived']).optional(),
  featured: z.boolean().optional()
});

export const collectibleBatchSchema = z.object({
  items: z.array(collectibleCreateSchema).min(1).max(50)
});

export const agentCollectSchema = collectibleCreateSchema.extend({
  dedupeByUrl: z.boolean().optional().default(true)
});

const coordinatePair = (data: { lat?: number | null; lng?: number | null }) => {
  const hasLat = data.lat !== undefined && data.lat !== null;
  const hasLng = data.lng !== undefined && data.lng !== null;
  return hasLat === hasLng;
};

export const photoCreateSchema = z
  .object({
    url: z.string().trim().min(1),
    title: trimmed.max(120).optional().default(''),
    date: trimmed.min(4).max(30),
    locationName: trimmed.max(120).optional().default(''),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(12).optional().default([]),
    favorite: z.boolean().optional().default(false),
    visibility: z.enum(['public', 'private']).optional().default('public'),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    size: z.number().positive().optional(),
    mimeType: trimmed.max(60).optional()
  })
  .refine(coordinatePair, { message: 'lat 和 lng 需要成对出现。', path: ['lat'] });

export const photoPatchSchema = z
  .object({
    url: z.string().trim().min(1).optional(),
    title: trimmed.max(120).optional(),
    date: trimmed.min(4).max(30).optional(),
    locationName: trimmed.max(120).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
    favorite: z.boolean().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    size: z.number().positive().optional(),
    mimeType: trimmed.max(60).optional()
  })
  .refine(coordinatePair, { message: 'lat 和 lng 需要成对出现。', path: ['lat'] });

export const photoBatchSchema = z.object({
  action: z.enum(['favorite', 'unfavorite', 'trash', 'restore', 'purge']),
  ids: z.array(z.string().trim().min(1)).min(1).max(500)
});

export const uploadResponseSchema = z.object({
  url: z.string().min(1)
});
