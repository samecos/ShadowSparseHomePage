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

export const faceBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().positive().max(1),
  h: z.number().positive().max(1)
});

export const photoFacesSchema = z.object({
  faces: z
    .array(
      z.object({
        box: faceBoxSchema,
        descriptor: z.array(z.number()).length(128),
        thumbUrl: trimmed.min(1).max(300)
      })
    )
    .max(32)
});

export const personPatchSchema = z.object({
  name: trimmed.min(1).max(40).nullable().optional(),
  coverFaceId: trimmed.min(1).nullable().optional(),
  hidden: z.boolean().optional()
});

export const peopleMergeSchema = z.object({
  sourceId: trimmed.min(1),
  targetId: trimmed.min(1)
});

export const uploadResponseSchema = z.object({
  url: z.string().min(1)
});

const tripPlanItemSchema = z
  .object({
    id: trimmed.min(1).max(80),
    time: trimmed.max(30).optional(),
    title: trimmed.min(1).max(160),
    note: trimmed.max(1000).optional(),
    locationName: trimmed.max(160).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    url: optionalUrl,
    type: z.enum(['place', 'transport', 'stay', 'activity', 'note']).default('place')
  })
  .refine(coordinatePair, { message: 'lat 和 lng 需要成对出现。', path: ['lat'] });

const tripChecklistItemSchema = z.object({
  id: trimmed.min(1).max(80),
  label: trimmed.min(1).max(160),
  category: z.enum(['luggage', 'document', 'device', 'purchase', 'other']).optional(),
  completed: z.boolean().default(false)
});

const tripDaySchema = z.object({
  id: trimmed.min(1).max(80),
  date: trimmed.min(4).max(30),
  title: trimmed.max(120).optional(),
  items: z.array(tripPlanItemSchema).max(80).default([]),
  checklist: z.array(tripChecklistItemSchema).max(80).default([])
});

const tripReservationSchema = z.object({
  id: trimmed.min(1).max(80),
  type: z.enum(['transport', 'stay', 'activity']),
  title: trimmed.min(1).max(160),
  provider: trimmed.max(120).optional(),
  startAt: trimmed.max(40).optional(),
  endAt: trimmed.max(40).optional(),
  locationName: trimmed.max(160).optional(),
  confirmationCode: trimmed.max(160).optional(),
  url: optionalUrl,
  attachmentIds: z.array(trimmed.min(1).max(100)).max(20).default([])
});

const tripEntrySchema = z
  .object({
    id: trimmed.min(1).max(80),
    dayId: trimmed.max(80).optional(),
    createdAt: trimmed.min(4).max(40),
    type: z.enum(['note', 'photo', 'place']),
    text: trimmed.max(3000).optional(),
    attachmentIds: z.array(trimmed.min(1).max(100)).max(20).optional(),
    locationName: trimmed.max(160).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    visibility: z.enum(['private', 'public']).default('private')
  })
  .refine(coordinatePair, { message: 'lat 和 lng 需要成对出现。', path: ['lat'] });

const tripRecapSchema = z.object({
  intro: trimmed.max(3000).optional(),
  dayTitles: z.record(z.string(), trimmed.max(120)).optional(),
  hiddenEntryIds: z.array(trimmed.min(1).max(80)).max(500).optional(),
  featuredAttachmentIds: z.array(trimmed.min(1).max(100)).max(100).optional(),
  pdfEnabled: z.boolean().optional()
});

const tripFields = {
  title: trimmed.min(1).max(160),
  summary: trimmed.max(3000).default(''),
  coverAttachmentId: trimmed.max(100).optional(),
  destinations: z.array(trimmed.min(1).max(120)).max(20).default([]),
  startDate: trimmed.min(4).max(30),
  endDate: trimmed.min(4).max(30),
  status: z.enum(['planning', 'active', 'completed', 'archived']).default('planning'),
  visibility: z.enum(['private', 'public']).default('private'),
  tags: z.array(trimmed.min(1).max(24)).max(20).default([]),
  days: z.array(tripDaySchema).max(100).default([]),
  reservations: z.array(tripReservationSchema).max(100).default([]),
  entries: z.array(tripEntrySchema).max(1000).default([]),
  recap: tripRecapSchema.optional()
};

const tripPatchFields = {
  title: trimmed.min(1).max(160),
  summary: trimmed.max(3000),
  coverAttachmentId: trimmed.max(100),
  destinations: z.array(trimmed.min(1).max(120)).max(20),
  startDate: trimmed.min(4).max(30),
  endDate: trimmed.min(4).max(30),
  status: z.enum(['planning', 'active', 'completed', 'archived']),
  visibility: z.enum(['private', 'public']),
  tags: z.array(trimmed.min(1).max(24)).max(20),
  days: z.array(tripDaySchema).max(100),
  reservations: z.array(tripReservationSchema).max(100),
  entries: z.array(tripEntrySchema).max(1000),
  recap: tripRecapSchema
};

export const tripCreateSchema = z
  .object(tripFields)
  .superRefine((value, context) => {
    const start = new Date(value.startDate).getTime();
    const end = new Date(value.endDate).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: '结束日期不能早于开始日期。' });
    }
  });

export const tripPatchSchema = z
  .object(tripPatchFields)
  .partial()
  .superRefine((value, context) => {
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate).getTime();
      const end = new Date(value.endDate).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        context.addIssue({ code: 'custom', path: ['endDate'], message: '结束日期不能早于开始日期。' });
      }
    }
  });
