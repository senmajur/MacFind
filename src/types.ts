export type ItemStatus = 'found' | 'lost' | 'claimed';

export type ItemCategory =
  | 'electronics'
  | 'clothing'
  | 'id'
  | 'keys'
  | 'bag'
  | 'book'
  | 'water_bottle'
  | 'sports'
  | 'other';

export interface ItemImage {
  id?: string;
  path: string;
  thumbnail_path?: string | null;
  is_blurred?: boolean | null;
}

export interface AIAnalysis {
  vague_label?: string | null;
  confidence?: number | null;
  analysis?: unknown;
}

export interface Item {
  id: string;
  title?: string | null;
  vague_description?: string | null;
  status: ItemStatus;
  category?: ItemCategory | string | null;
  location_hint?: string | null;
  metadata?: Record<string, unknown> | null;
  best_ai_confidence?: number | null;
  created_at?: string | null;
  owner_id?: string | null;
  // Some schemas use `poster_id` instead of `owner_id`
  poster_id?: string | null;
  // Optional fields used by the backend ingest example
  object_type?: string | null;
  color?: string | null;
  item_images?: ItemImage[];
  ai_image_analyses?: AIAnalysis[];
}

export interface Message {
  id: string;
  item_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  sender_macid?: string | null;
  created_at?: string | null;
  read_at?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

export interface ItemFilters {
  search?: string;
  tag?: string;
  status?: ItemStatus | '';
  location?: string;
  timeRange?: '24h' | 'week' | 'all';
}

export interface PostFoundPayload {
  file?: File | null;
  locationFoundAt: string;
  description?: string;
  tags?: string[];
  suggestedTags?: string[];
}
