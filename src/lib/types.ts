export type Visibility = 'public' | 'private';

export interface Post {
  id: string;
  content: string;
  mood?: string;
  images: string[];
  location?: string;
  visibility: Visibility;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MapPhoto {
  id: string;
  url: string;
  caption: string;
  lat: number;
  lng: number;
  width?: number;
  height?: number;
}

export interface MapStory {
  id: string;
  title: string;
  note: string;
  date: string;
  locationName: string;
  tags: string[];
  photos: MapPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface PhotoRegion {
  adcode: string;
  province: string;
  city: string;
}

export interface Photo {
  id: string;
  url: string;
  title: string;
  date: string;
  locationName: string;
  lat?: number;
  lng?: number;
  tags: string[];
  favorite: boolean;
  visibility: Visibility;
  width?: number;
  height?: number;
  size?: number;
  mimeType?: string;
  region?: PhotoRegion | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkMetric {
  label: string;
  value: string;
  note?: string;
}

export interface WorkSection {
  heading: string;
  body: string[];
  image?: string;
  caption?: string;
}

export interface Work {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  year: string;
  client?: string;
  role: string;
  summary: string;
  cover: string;
  tags: string[];
  metrics: WorkMetric[];
  sections: WorkSection[];
  featured: boolean;
  order: number;
}

export type CollectibleType = 'link' | 'image' | 'quote' | 'moment' | 'file';
export type CollectibleStatus = 'inbox' | 'curated' | 'archived';
export type Collector = 'me' | 'hermes' | 'unknown';

export interface Collectible {
  id: string;
  title: string;
  type: CollectibleType;
  url?: string;
  image?: string;
  quote?: string;
  description?: string;
  agentSummary?: string;
  tags: string[];
  source?: string;
  collectedBy: Collector;
  status: CollectibleStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'planning' | 'active' | 'completed' | 'archived';
export type TripVisibility = 'private' | 'public';
export type TripPlanItemType = 'place' | 'transport' | 'stay' | 'activity' | 'note';
export type TripEntryType = 'note' | 'photo' | 'place';

export interface TripChecklistItem {
  id: string;
  label: string;
  category?: 'luggage' | 'document' | 'device' | 'purchase' | 'other';
  completed: boolean;
}

export interface TripPlanItem {
  id: string;
  time?: string;
  title: string;
  note?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  url?: string;
  type: TripPlanItemType;
}

export interface TripDay {
  id: string;
  date: string;
  title?: string;
  items: TripPlanItem[];
  checklist: TripChecklistItem[];
}

export interface TripEntry {
  id: string;
  dayId?: string;
  createdAt: string;
  type: TripEntryType;
  text?: string;
  attachmentIds?: string[];
  locationName?: string;
  lat?: number;
  lng?: number;
  visibility: TripVisibility;
}

export interface TripReservation {
  id: string;
  type: 'transport' | 'stay' | 'activity';
  title: string;
  provider?: string;
  startAt?: string;
  endAt?: string;
  locationName?: string;
  confirmationCode?: string;
  url?: string;
  attachmentIds: string[];
}

export interface TripRecap {
  intro?: string;
  dayTitles?: Record<string, string>;
  hiddenEntryIds?: string[];
  featuredAttachmentIds?: string[];
  pdfEnabled?: boolean;
}

export type TripEditor = 'admin' | 'hermes';

export interface Trip {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverAttachmentId?: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  status: TripStatus;
  visibility: TripVisibility;
  tags: string[];
  days: TripDay[];
  reservations: TripReservation[];
  entries: TripEntry[];
  recap?: TripRecap;
  lastEditedBy?: TripEditor;
  createdAt: string;
  updatedAt: string;
}

export type TripAttachmentKind = 'media' | 'reservation';

export interface TripAttachment {
  id: string;
  tripId: string;
  reservationId?: string;
  kind: TripAttachmentKind;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  createdBy: TripEditor;
  createdAt: string;
}

export type TripAttachmentSummary = Omit<TripAttachment, 'storageKey'>;

export interface FaceInstance {
  id: string;
  photoId: string;
  /** 相对原图的归一化坐标(0-1) */
  box: { x: number; y: number; w: number; h: number };
  /** 128 维人脸特征向量 */
  descriptor: number[];
  thumbUrl: string;
  personId: string | null;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string | null;
  faceIds: string[];
  coverFaceId: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}
