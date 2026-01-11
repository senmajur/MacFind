import type { Item, Message } from '../types';

const placeholderImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%237A003C" stop-opacity="0.9"/><stop offset="100%" stop-color="%23FDB515" stop-opacity="0.8"/></linearGradient></defs><rect width="640" height="400" rx="32" fill="%23f8f4ec"/><rect x="24" y="24" width="592" height="352" rx="28" fill="url(%23grad)" opacity="0.7"/><text x="50%" y="52%" text-anchor="middle" fill="%23f8f4ec" font-family="Verdana" font-size="36">Blurred for safety</text></svg>';

export const demoItems: Item[] = [
  {
    id: 'item-airpods',
    title: 'AirPods Case',
    vague_description: 'white apple airpods',
    status: 'found',
    category: 'electronics',
    location_hint: 'MUSC atrium seating',
    metadata: { tags: ['airpods', 'apple', 'wireless earbuds'], colors: ['white'] },
    best_ai_confidence: 0.93,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    owner_id: 'finder-1',
    item_images: [{ path: placeholderImage, is_blurred: true }],
    ai_image_analyses: [
      { vague_label: 'white apple airpods', confidence: 0.93, analysis: { category: 'electronics' } },
    ],
  },
  {
    id: 'item-hoodie',
    title: 'Red hoodie',
    vague_description: 'maroon hoodie with white strings',
    status: 'found',
    category: 'clothing',
    location_hint: 'Mills Library 3rd floor',
    metadata: { colors: ['red', 'white'], tags: ['hoodie', 'mcmaster'] },
    best_ai_confidence: 0.88,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    owner_id: 'finder-2',
    item_images: [{ path: placeholderImage, is_blurred: true }],
    ai_image_analyses: [
      { vague_label: 'red hoodie', confidence: 0.88, analysis: { category: 'clothing' } },
    ],
  },
  {
    id: 'item-idcard',
    title: 'Student ID card',
    vague_description: 'mcmaster student card',
    status: 'found',
    category: 'id',
    location_hint: 'ETB main entrance',
    metadata: { colors: ['white', 'gold'], tags: ['id card', 'student id'] },
    best_ai_confidence: 0.91,
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    owner_id: 'finder-1',
    item_images: [{ path: placeholderImage, is_blurred: true }],
    ai_image_analyses: [
      { vague_label: 'student id card', confidence: 0.91, analysis: { category: 'id' } },
    ],
  },
  {
    id: 'item-keys',
    title: 'Keychain with purple tag',
    vague_description: 'set of keys with purple tag',
    status: 'claimed',
    category: 'keys',
    location_hint: 'Togo Salmon Hall steps',
    metadata: { colors: ['silver', 'purple'], tags: ['keys', 'keychain'] },
    best_ai_confidence: 0.85,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    owner_id: 'finder-2',
    item_images: [{ path: placeholderImage, is_blurred: true }],
    ai_image_analyses: [
      { vague_label: 'silver keys with purple tag', confidence: 0.85, analysis: { category: 'keys' } },
    ],
  },
];

export const demoMessages: Message[] = [
  {
    id: 'msg-1',
    item_id: 'item-airpods',
    sender_id: 'owner-1',
    receiver_id: 'finder-1',
    body: 'CLAIM: Lost my AirPods near MUSC, white case with a tiny sticker inside.',
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-2',
    item_id: 'item-airpods',
    sender_id: 'finder-1',
    receiver_id: 'owner-1',
    body: 'Hey! Sounds like a match. Can you describe the sticker?',
    created_at: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-3',
    item_id: 'item-hoodie',
    sender_id: 'owner-2',
    receiver_id: 'finder-2',
    body: 'CLAIM: Maroon hoodie with white drawstrings, size L.',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
];
