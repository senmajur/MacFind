/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { hasSupabase, supabase } from '../lib/supabase';
import type {
  Item,
  ItemFilters,
  ItemStatus,
  Message,
  PostFoundPayload,
  UserProfile,
} from '../types';
import {
  demoItems as demoItemsSeed,
  demoMessages as demoMessagesSeed,
} from '../data/demo';
import {
  ensureUserRow,
  extractReferencedTableFromForeignKeyError,
} from '../lib/appUser';

interface DataContextValue {
  items: Item[];
  loading: boolean;
  mode: 'supabase' | 'demo';
  refreshItems: (filters?: ItemFilters) => Promise<void>;
  getItem: (id: string) => Promise<Item | null>;
  postFound: (
    payload: PostFoundPayload,
    user: UserProfile | null,
  ) => Promise<Item | null>;
  claimItem: (itemId: string, user: UserProfile | null, proof: string) => Promise<void>;
  sendMessage: (
    itemId: string,
    receiverId: string,
    body: string,
    sender: UserProfile | null,
  ) => Promise<void>;
  fetchMessages: (
    itemId: string,
    currentUserId?: string,
    otherUserId?: string,
  ) => Promise<Message[]>;
  fetchUnreadMessages: (receiverId: string) => Promise<Message[]>;
  markThreadRead: (
    itemId: string,
    otherUserId: string,
    receiverId: string,
  ) => Promise<void>;
  markStatus: (itemId: string, status: ItemStatus) => Promise<void>;
  deleteItem: (itemId: string, user: UserProfile | null) => Promise<boolean>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

const getItemTags = (item: Item): string[] => {
  const tags =
    (Array.isArray(item.metadata?.tags)
      ? item.metadata?.tags
      : []) as unknown[];
  return tags
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase().trim())
    .filter(Boolean);
};

const normalizeItem = (item: Item): Item => {
  const posterId = typeof item.poster_id === 'string' ? item.poster_id : null;
  const ownerId = typeof item.owner_id === 'string' ? item.owner_id : null;

  const objectType =
    typeof item.object_type === 'string' ? item.object_type : null;
  const color = typeof item.color === 'string' ? item.color : null;

  const vagueDescription =
    item.vague_description ??
    (objectType && color ? `${color} ${objectType}` : objectType) ??
    null;

  return {
    ...item,
    owner_id: ownerId ?? posterId ?? null,
    vague_description: vagueDescription,
  };
};

const applyDemoFilters = (source: Item[], filters?: ItemFilters) => {
  const now = Date.now();
  return source.filter((item) => {
    if (filters?.status && item.status !== filters.status) return false;
    if (filters?.tag) {
      const tags = getItemTags(item);
      if (!tags.some((tag) => tag.includes(filters.tag!.toLowerCase()))) return false;
    }
    if (filters?.location) {
      const locationHaystack = item.location_hint?.toLowerCase() ?? '';
      if (!locationHaystack.includes(filters.location.toLowerCase())) return false;
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      const haystack = [
        item.title,
        item.vague_description,
        item.metadata ? JSON.stringify(item.metadata) : '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters?.timeRange && item.created_at) {
      const created = new Date(item.created_at).getTime();
      if (filters.timeRange === '24h' && created < now - 24 * 60 * 60 * 1000) return false;
      if (filters.timeRange === 'week' && created < now - 7 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [demoAllItems, setDemoAllItems] = useState<Item[]>(demoItemsSeed);
  const [items, setItems] = useState<Item[]>(demoItemsSeed);
  const [demoMessages, setDemoMessages] = useState<Message[]>(demoMessagesSeed);
  const [loading, setLoading] = useState(false);
  const mode: 'supabase' | 'demo' = hasSupabase ? 'supabase' : 'demo';

  const refreshItems = useCallback(
    async (filters?: ItemFilters) => {
      setLoading(true);
      if (!supabase) {
        setItems(applyDemoFilters(demoAllItems, filters));
        setLoading(false);
        return;
      }

      // Keep selects conservative so the app works even if your Supabase schema
      // doesn't have optional columns/relationships (e.g. `category`, `ai_image_analyses` FK).
      let query = supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.location)
        query = query.ilike('location_hint', `%${filters.location}%`);
      if (filters?.tag)
        query = query.ilike('metadata->>tags', `%${filters.tag}%`);

      const now = new Date();
      if (filters?.timeRange === '24h')
        query = query.gte(
          'created_at',
          new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        );
      if (filters?.timeRange === 'week')
        query = query.gte(
          'created_at',
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        );

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load items', error.message);
        setLoading(false);
        return;
      }

      const baseItems = ((data ?? []) as Item[]).map(normalizeItem);
      const filtered = applyDemoFilters(baseItems, filters);

      // Attach images without requiring a DB foreign key relationship.
      const itemIds = filtered.map((item) => item.id).filter(Boolean);
      if (itemIds.length) {
        const { data: images, error: imagesError } = await supabase
          .from('item_images')
          .select('item_id,storage_path,thumbnail_path')
          .in('item_id', itemIds);
        if (imagesError) {
          console.warn('Could not load item images', imagesError.message);
          setItems(filtered);
          setLoading(false);
          return;
        }

        const imagesByItem = new Map<string, Item['item_images']>();
        for (const row of images ?? []) {
          const itemId = (row as { item_id?: unknown }).item_id;
          const storagePath = (row as { storage_path?: unknown }).storage_path;
          const thumbnailPath = (row as { thumbnail_path?: unknown })
            .thumbnail_path;
          if (typeof itemId !== 'string') continue;

          const path =
            typeof storagePath === 'string'
              ? storagePath
              : typeof thumbnailPath === 'string'
                ? thumbnailPath
                : null;
          if (!path) continue;

          const list = imagesByItem.get(itemId) ?? [];
          list.push({
            path,
            thumbnail_path: typeof thumbnailPath === 'string' ? thumbnailPath : null,
          });
          imagesByItem.set(itemId, list);
        }

        setItems(
          filtered.map((item) => ({
            ...item,
            item_images:
              imagesByItem.get(item.id) ?? item.item_images ?? [],
          })),
        );
        setLoading(false);
        return;
      }

      setItems(filtered);
      setLoading(false);
    },
    [demoAllItems],
  );

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void refreshItems({ status: 'found' });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshItems]);

  const getItem = useCallback(
    async (id: string) => {
      if (!supabase) {
        return items.find((item) => item.id === id) ?? null;
      }
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Failed to load item', error.message);
        return null;
      }
      const item = normalizeItem(data as Item);

      const { data: images, error: imagesError } = await supabase
        .from('item_images')
        .select('item_id,storage_path,thumbnail_path')
        .eq('item_id', id);
      if (imagesError) {
        return item;
      }
      const mapped =
        images?.flatMap((row) => {
          const storagePath = (row as { storage_path?: unknown }).storage_path;
          const thumbnailPath = (row as { thumbnail_path?: unknown })
            .thumbnail_path;
          const path =
            typeof storagePath === 'string'
              ? storagePath
              : typeof thumbnailPath === 'string'
                ? thumbnailPath
                : null;
          if (!path) return [];
          return [
            {
              path,
              thumbnail_path:
                typeof thumbnailPath === 'string' ? thumbnailPath : null,
            },
          ];
        }) ?? [];
      return { ...item, item_images: mapped };
    },
    [items],
  );

  const postFound = useCallback(
    async (payload: PostFoundPayload, user: UserProfile | null) => {
      if (!supabase) {
        const metadata: Record<string, unknown> = {};
        if (payload.description) metadata.notes = payload.description;
        if (payload.tags?.length) metadata.tags = payload.tags;
        if (payload.suggestedTags?.length) metadata.suggested_tags = payload.suggestedTags;

        const newItem: Item = {
          id: crypto.randomUUID(),
          vague_description:
            payload.description || 'Found item (awaiting AI label)',
          status: 'found',
          category: 'other',
          location_hint: payload.locationFoundAt,
          metadata,
          best_ai_confidence: 0.42,
          created_at: new Date().toISOString(),
          owner_id: user?.id ?? 'demo-finder',
          item_images: payload.file
            ? [
                {
                  path: URL.createObjectURL(payload.file),
                  is_blurred: true,
                },
              ]
            : [],
          ai_image_analyses: payload.description
            ? [
                {
                  vague_label: payload.description,
                  confidence: 0.42,
                },
              ]
            : [],
        };
        setDemoAllItems((prev) => [newItem, ...prev]);
        setItems((prev) => [newItem, ...prev]);
        return newItem;
      }

      const metadata: Record<string, unknown> = {};
      if (payload.description) metadata.notes = payload.description;
      if (payload.tags?.length) metadata.tags = payload.tags;
      if (payload.suggestedTags?.length) metadata.suggested_tags = payload.suggestedTags;

      const insertPayload: Record<string, unknown> = {
        vague_description: payload.description ?? null,
        status: 'found',
        metadata,
        location_hint: payload.locationFoundAt,
        poster_id: user?.id ?? null,
      };

      let item: Item | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data, error } = await supabase
          .from('items')
          .insert(insertPayload)
          .select()
          .single();

        if (!error) {
          item = normalizeItem(data as Item);
          break;
        }

        const match = /Could not find the '([^']+)' column of 'items'/.exec(
          error.message,
        );
        if (match?.[1] && match[1] in insertPayload) {
          delete insertPayload[match[1]];
          continue;
        }

        const isPosterForeignKeyError =
          error.code === '23503' &&
          error.message.toLowerCase().includes('poster_id_fkey');

        if (isPosterForeignKeyError && user?.id) {
          const referencedTable =
            extractReferencedTableFromForeignKeyError(error) ?? 'users';
          const ensured = await ensureUserRow(supabase, user, referencedTable);
          if (ensured) continue;

          console.error('Failed to post item (missing user row)', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            referencedTable,
          });
          return null;
        }

        console.error('Failed to post item', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return null;
      }

      if (!item) return null;
      try {
        if (user?.id) {
          const key = `macfind:my-item-ids:${user.id}`;
          const raw = localStorage.getItem(key);
          const existing = Array.isArray(raw ? JSON.parse(raw) : null)
            ? (JSON.parse(raw ?? '[]') as unknown[])
            : [];
          const ids = existing.filter((value): value is string => typeof value === 'string');
          const next = Array.from(new Set([item.id, ...ids]));
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // ignore localStorage failures
      }

      if (payload.file) {
        const bucket = 'item-images';
        const storagePath = `${item.id}/${crypto.randomUUID()}.jpg`;

        const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, payload.file, { upsert: true });

        if (uploadError) {
          console.error('Failed to upload image', uploadError.message);
        } else {
          const { error: imageInsertError } = await supabase
            .from('item_images')
            .insert({
              item_id: item.id,
              storage_path: storagePath,
              thumbnail_path: storagePath,
            });
          if (imageInsertError) {
            console.error('Failed to record image', imageInsertError.message);
          } else {
            item = {
              ...item,
              item_images: [{ path: storagePath, thumbnail_path: storagePath }],
            };
          }
        }
      }

      setItems((prev) => [item as Item, ...prev.filter((i) => i.id !== item!.id)]);
      await refreshItems({ status: 'found' });
      return item;
    },
    [refreshItems],
  );

  const claimItem = useCallback(
    async (itemId: string, user: UserProfile | null, proof: string) => {
      const item = items.find((i) => i.id === itemId);
      const receiverId = item?.owner_id ?? '';

      if (!supabase) {
        const message: Message = {
          id: crypto.randomUUID(),
          item_id: itemId,
          sender_id: user?.id ?? 'demo-claimer',
          receiver_id: receiverId || 'demo-finder',
          body: `CLAIM: ${proof}`,
          created_at: new Date().toISOString(),
        };
        setDemoMessages((prev) => [...prev, message]);
        return;
      }

      const { error } = await supabase.from('messages').insert({
        item_id: itemId,
        sender_id: user?.id ?? null,
        receiver_id: receiverId,
        body: `CLAIM: ${proof}`,
      });
      if (error) console.error('Failed to create claim message', error.message);
    },
    [items],
  );

  const sendMessage = useCallback(
    async (
      itemId: string,
      receiverId: string,
      body: string,
      sender: UserProfile | null,
    ) => {
      const macid = sender?.email ? sender.email.split('@')[0] : null;
      if (!supabase) {
        const message: Message = {
          id: crypto.randomUUID(),
          item_id: itemId,
          sender_id: sender?.id ?? 'demo-sender',
          receiver_id: receiverId,
          body,
          sender_macid: macid,
          created_at: new Date().toISOString(),
        };
        setDemoMessages((prev) => [...prev, message]);
        return;
      }

      const payload: Record<string, unknown> = {
        item_id: itemId,
        sender_id: sender?.id ?? null,
        receiver_id: receiverId,
        body,
        sender_macid: macid,
      };

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { error } = await supabase.from('messages').insert(payload);
        if (!error) return;
        if (error.message.includes("column 'sender_macid' does not exist")) {
          delete payload.sender_macid;
          continue;
        }
        console.error('Failed to send message', error.message);
        return;
      }
    },
    [],
  );

  const fetchMessages = useCallback(
    async (itemId: string, currentUserId?: string, otherUserId?: string) => {
      if (!supabase) {
        return demoMessages.filter((m) => {
          const isSameItem = m.item_id === itemId;
          if (!currentUserId || !otherUserId) return isSameItem;
          const comboMatches =
            (m.sender_id === currentUserId && m.receiver_id === otherUserId) ||
            (m.sender_id === otherUserId && m.receiver_id === currentUserId);
          return isSameItem && comboMatches;
        });
      }

      let query = supabase
        .from('messages')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      if (currentUserId && otherUserId) {
        query = query.or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`,
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load messages', error.message);
        return [];
      }
      return data as Message[];
    },
    [demoMessages],
  );

  const fetchUnreadMessages = useCallback(
    async (receiverId: string) => {
      if (!supabase) {
        return demoMessages.filter(
          (m) => m.receiver_id === receiverId && !m.read_at,
        );
      }
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', receiverId)
        .is('read_at', null)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load unread messages', error.message);
        return [];
      }
      return data as Message[];
    },
    [demoMessages],
  );

  const markThreadRead = useCallback(
    async (itemId: string, otherUserId: string, receiverId: string) => {
      if (!supabase) {
        setDemoMessages((prev) =>
          prev.map((m) =>
            m.item_id === itemId &&
            m.receiver_id === receiverId &&
            m.sender_id === otherUserId
              ? { ...m, read_at: new Date().toISOString() }
              : m,
          ),
        );
        return;
      }
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('item_id', itemId)
        .eq('receiver_id', receiverId)
        .eq('sender_id', otherUserId)
        .is('read_at', null);
      if (error) console.warn('Failed to mark thread read', error.message);
    },
    [],
  );

  const markStatus = useCallback(
    async (itemId: string, status: ItemStatus) => {
      if (!supabase) {
        setDemoAllItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        );
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        );
        return;
      }

      const { error } = await supabase
        .from('items')
        .update({ status })
        .eq('id', itemId);
      if (error) console.error('Failed to update status', error.message);
      await refreshItems();
    },
    [refreshItems],
  );

  const deleteItem = useCallback(
    async (itemId: string, user: UserProfile | null) => {
      if (!itemId) return false;
      if (!supabase) {
        setDemoMessages((prev) => prev.filter((m) => m.item_id !== itemId));
        setDemoAllItems((prev) => prev.filter((item) => item.id !== itemId));
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        return true;
      }

      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) {
        console.error('Failed to delete item', error.message);
        return false;
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      await refreshItems({ status: 'found' });

      if (user?.id) {
        try {
          const key = `macfind:my-item-ids:${user.id}`;
          const raw = localStorage.getItem(key);
          const parsed = raw ? (JSON.parse(raw) as unknown) : null;
          const ids = Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string')
            : [];
          const next = ids.filter((id) => id !== itemId);
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore localStorage failures
        }
      }

      return true;
    },
    [refreshItems],
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      mode,
      refreshItems,
      getItem,
      postFound,
      claimItem,
      sendMessage,
      fetchMessages,
      fetchUnreadMessages,
      markThreadRead,
      markStatus,
      deleteItem,
    }),
    [
      items,
      loading,
      mode,
      refreshItems,
      getItem,
      postFound,
      claimItem,
      sendMessage,
      fetchMessages,
      fetchUnreadMessages,
      markThreadRead,
      markStatus,
      deleteItem,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
