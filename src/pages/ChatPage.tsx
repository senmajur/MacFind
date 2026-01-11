import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { timeAgo } from '../utils/format';
import type { Item, Message } from '../types';

const quickPrompts = [
  'Where can I pick it up?',
  'I left it with security at Mills.',
  'Can we meet at MUSC atrium?',
  'What proof do you need?',
];

const macFromEmail = (email?: string | null) =>
  email ? email.split('@')[0] : 'Unknown';

const sortMessages = (list: Message[]) =>
  [...list].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime(),
  );

export const ChatPage = () => {
  const { itemId, otherUserId } = useParams();
  const { user, requireLogin } = useAuth();
  const { fetchMessages, sendMessage, getItem, markStatus, markThreadRead } =
    useData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [item, setItem] = useState<Item | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const channelRef = useRef<
    ReturnType<NonNullable<typeof supabase>['channel']> | null
  >(null);
  const hasClosedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!itemId) return;
      const data = await fetchMessages(itemId, user?.id, otherUserId);
      setMessages(sortMessages(data));
      const loadedItem = await getItem(itemId);
      setItem(loadedItem);
      setLoading(false);
      if (otherUserId && user?.id) {
        void markThreadRead(itemId, otherUserId, user.id);
      }
    };
    void load();
  }, [fetchMessages, getItem, itemId, otherUserId, user?.id, markThreadRead]);

  useEffect(() => {
    const client = supabase;
    if (!client || !itemId) return;
    const channel = client
      .channel(`messages-${itemId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `item_id=eq.${itemId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return sortMessages([...prev, newMsg]);
          });
          if (otherUserId && user?.id && newMsg.receiver_id === user.id) {
            void markThreadRead(itemId, otherUserId, user.id);
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
      }
    };
  }, [itemId, otherUserId, user?.id, markThreadRead]);

  const resolveName = useMemo(
    () => async (id: string) => {
      if (nameMap[id]) return;
      if (user && id === user.id) {
        setNameMap((prev) => ({
          ...prev,
          [id]: macFromEmail(user.email),
        }));
        return;
      }
      if (!supabase) {
        setNameMap((prev) => ({
          ...prev,
          [id]: id.slice(0, 6),
        }));
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('email,name')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        setNameMap((prev) => ({ ...prev, [id]: id.slice(0, 6) }));
        return;
      }
      const display =
        data?.email ? macFromEmail(data.email) : data?.name ?? id.slice(0, 6);
      setNameMap((prev) => ({ ...prev, [id]: display }));
    },
    [nameMap, user],
  );

  useEffect(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(user.id);
    if (otherUserId) ids.add(otherUserId);
    messages.forEach((m) => {
      ids.add(m.sender_id);
      ids.add(m.receiver_id);
    });
    ids.forEach((id) => void resolveName(id));
  }, [messages, otherUserId, user?.id, resolveName]);

  const handleSend = async (body: string) => {
    if (!itemId || !otherUserId) return;
    if (!requireLogin(`/chat/${itemId}/${otherUserId}`)) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    await sendMessage(itemId, otherUserId, trimmed, user);
    setMessages((prev) =>
      sortMessages([
        ...prev,
        {
          id: crypto.randomUUID(),
          item_id: itemId,
          sender_id: user?.id ?? 'me',
          receiver_id: otherUserId,
          body: trimmed,
          created_at: new Date().toISOString(),
        },
      ]),
    );
    setInput('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSend(input);
  };

  const statusPayloads = useMemo(() => {
    const foundBy = new Set(messages.filter((m) => m.body === 'STATUS:FOUND_CONFIRMED').map((m) => m.sender_id));
    const returnedBy = new Set(messages.filter((m) => m.body === 'STATUS:RETURN_CONFIRMED').map((m) => m.sender_id));
    return { foundBy, returnedBy };
  }, [messages]);

  const bothConfirmed =
    itemId &&
    otherUserId &&
    statusPayloads.foundBy.size > 0 &&
    statusPayloads.returnedBy.size > 0 &&
    statusPayloads.foundBy.has(otherUserId) &&
    statusPayloads.returnedBy.has(user?.id ?? '');

  useEffect(() => {
    if (bothConfirmed && itemId && !hasClosedRef.current) {
      hasClosedRef.current = true;
      void markStatus(itemId, 'claimed');
    }
  }, [bothConfirmed, itemId, markStatus]);

  const handleStatusClick = (kind: 'FOUND' | 'RETURN') => {
    const code =
      kind === 'FOUND' ? 'STATUS:FOUND_CONFIRMED' : 'STATUS:RETURN_CONFIRMED';
    void handleSend(code);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading chat...</div>
      </div>
    );
  }

  const finderName =
    nameMap[item?.owner_id ?? ''] || macFromEmail(item?.metadata?.finder_email as string);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="pill">Chat</p>
          <h2>Coordinate pickup</h2>
          <p className="lede">
            Ask questions, prove ownership, and share where the item can be picked up or was kept.
            Item: {item?.vague_description || item?.title || 'Item'} - blurred image for safety.
          </p>
        </div>
      </div>
      <div className="callout">
        Suggest safe meetup spots: MUSC atrium, Mills entrance, ETB lobby. Meet during daytime with a friend if possible.
      </div>

      <div className="quick-prompts">
        <span className="hint">Quick prompts:</span>
        {quickPrompts.map((text) => (
          <button
            key={text}
            type="button"
            className="chip chip-soft"
            onClick={() => setInput(text)}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="chat-window">
        {messages.length === 0 && <p className="hint">No messages yet.</p>}
        {messages.map((msg) => {
          const mine = msg.sender_id === user?.id;
          const senderName =
            mine ? 'You' : nameMap[msg.sender_id] ?? msg.sender_id.slice(0, 6);
          if (msg.body === 'STATUS:FOUND_CONFIRMED') {
            return (
              <div key={msg.id} className="chat-bubble">
                <div className="chat-meta">
                  <span>{senderName}</span>
                  <span>{timeAgo(msg.created_at)}</span>
                </div>
                <div className="chat-body">
                  ✅ I found my item. Thanks {finderName || 'finder'}!
                </div>
              </div>
            );
          }
          if (msg.body === 'STATUS:RETURN_CONFIRMED') {
            return (
              <div key={msg.id} className="chat-bubble">
                <div className="chat-meta">
                  <span>{senderName}</span>
                  <span>{timeAgo(msg.created_at)}</span>
                </div>
                <div className="chat-body">👍 Item returned to owner.</div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`chat-bubble ${mine ? 'chat-mine' : ''}`}>
              <div className="chat-meta">
                <span>{senderName}</span>
                <span>{timeAgo(msg.created_at)}</span>
              </div>
              <div className="chat-body">{msg.body}</div>
            </div>
          );
        })}
      </div>

      <div className="chat-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() => handleStatusClick('FOUND')}
        >
          I found my item
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => handleStatusClick('RETURN')}
        >
          I returned the item
        </button>
        {bothConfirmed && <span className="hint">Post closed.</span>}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="Send a message (quiz question, meetup spot, proof check)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="primary-button" type="submit">
          Send
        </button>
      </form>
    </div>
  );
};
