import { supabase } from './supabase';

const isDirectSrc = (value: string) =>
  value.startsWith('http://') ||
  value.startsWith('https://') ||
  value.startsWith('data:') ||
  value.startsWith('blob:');

export const resolveImageSrc = (path?: string | null) => {
  if (!path) return null;
  if (isDirectSrc(path)) return path;
  if (!supabase) return null;

  return supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl;
};
