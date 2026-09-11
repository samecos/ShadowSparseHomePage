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
