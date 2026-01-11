import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { resolveImageSrc } from '../lib/images';
import type { Item, Message } from '../types';
import { timeAgo } from '../utils/format';

const formatMetadataSummary = (metadata: Item['metadata']) => {
  const tags = metadata?.tags;
  if (Array.isArray(tags)) {
    const values = tags.filter(
      (value): value is string => typeof value === 'string',
    );
    if (values.length) return values.join(', ');
  }
  const colors = metadata?.colors;
  if (Array.isArray(colors)) {
    const values = colors.filter(
      (value): value is string => typeof value === 'string',
    );
    if (values.length) return values.join(', ');
  }
  return null;
};

export const ItemDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signIn, requireLogin } = useAuth();
  const { getItem, claimItem, fetchMessages } = useData();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const loaded = await getItem(id);
      setItem(loaded);
      const fetchedMessages = await fetchMessages(id, user?.id);
      setMessages(fetchedMessages);
      setLoading(false);
    };
    void load();
  }, [fetchMessages, getItem, id, user?.id]);

  const isOwner = useMemo(
    () => Boolean(user && item?.owner_id === user.id),
    [item?.owner_id, user],
  );

  const otherClaimers = useMemo(() => {
    const uniqueSenders = new Map<string, Message>();
    messages.forEach((msg) => {
      if (msg.sender_id !== item?.owner_id) {
        uniqueSenders.set(msg.sender_id, msg);
      }
    });
    return Array.from(uniqueSenders.values());
  }, [item?.owner_id, messages]);

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!requireLogin(`/items/${id}`)) return;
    setStatusMessage(null);
    await claimItem(id, user, proof);
    setStatusMessage('Claim sent! Open chat to coordinate pickup.');
    setProof('');
    setClaimOpen(false);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <div className="card">Item not found.</div>
      </div>
    );
  }

  const rawImagePath =
    item.item_images?.[0]?.thumbnail_path ?? item.item_images?.[0]?.path ?? null;
  const imageSrc = resolveImageSrc(rawImagePath);
  const metadataSummary = formatMetadataSummary(item.metadata);
  const tagList =
    Array.isArray(item.metadata?.tags) && item.metadata?.tags.length
      ? item.metadata.tags
          .filter((value): value is string => typeof value === 'string')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="pill">Item detail</p>
          <h2>{item.vague_description || item.title || 'Unlabeled item'}</h2>
          <p className="lede">
            Posted {timeAgo(item.created_at)} - Location found at: {item.location_hint || 'TBD'}
          </p>
        </div>
        {!user && (
          <button
            className="primary-button"
            onClick={() => void signIn(`/items/${item.id}`)}
          >
            Log in to claim
          </button>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <div className="item-image blurred detail-image">
            {imageSrc ? (
              <img src={imageSrc} alt={item.vague_description || 'Lost item'} />
            ) : (
              <div className="image-placeholder">Blurred for safety</div>
            )}
            <div className="blur-overlay">Blurred by default</div>
          </div>
          <div className="info-row">
            <span className={`badge ${item.status === 'claimed' ? 'badge-claimed' : 'badge-found'}`}>
              {item.status.toUpperCase()}
            </span>
            {item.best_ai_confidence && (
              <span className="chip chip-soft">
                AI confidence {Math.round(item.best_ai_confidence * 100)}%
              </span>
            )}
          </div>
          <div className="meta">
            <div>
              <div className="meta-label">Location found at</div>
              <div className="meta-value">{item.location_hint || 'TBD'}</div>
            </div>
            <div>
              <div className="meta-label">Posted</div>
              <div className="meta-value">{timeAgo(item.created_at)}</div>
            </div>
            <div>
              <div className="meta-label">Tags</div>
              <div className="meta-value">
                {tagList.length ? (
                  <div className="chips">
                    {tagList.map((tag) => (
                      <span key={tag} className="chip chip-soft">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  metadataSummary || 'Pending'
                )}
              </div>
            </div>
          </div>
          <div className="callout">
            Suggested safe meetup spots: MUSC atrium, Mills entrance, ETB lobby.
            Meet during daytime if possible.
          </div>
        </div>

        <div className="detail-card">
          {!isOwner && item.status !== 'claimed' && (
            <>
              <h3>Claim this item</h3>
              {!claimOpen ? (
                <button
                  className="primary-button"
                  onClick={() => setClaimOpen(true)}
                >
                  Send proof to finder
                </button>
              ) : (
                <form className="form" onSubmit={handleClaim}>
                  <label className="form-label">
                    Describe proof it&apos;s yours
                    <textarea
                      className="input"
                      rows={4}
                      value={proof}
                      onChange={(e) => setProof(e.target.value)}
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Send claim
                  </button>
                </form>
              )}
              {statusMessage && <p className="hint">{statusMessage}</p>}
            </>
          )}

          {isOwner && (
            <>
              <h3>Incoming claims & chats</h3>
              {otherClaimers.length === 0 && (
                <p className="hint">No claims yet.</p>
              )}
              <div className="thread-list">
                {otherClaimers.map((msg) => (
                  <div key={msg.sender_id} className="thread-card">
                    <div>
                      <div className="thread-label">Claimer</div>
                      <div className="thread-value">{msg.sender_id}</div>
                      <div className="thread-snippet">{msg.body}</div>
                    </div>
                    <button
                      className="ghost-button"
                      onClick={() => navigate(`/chat/${item.id}/${msg.sender_id}`)}
                    >
                      View chat
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!isOwner && (
            <button
              className="ghost-button"
              onClick={() => navigate(`/chat/${item.id}/${item.owner_id ?? 'finder'}`)}
            >
              Open chat with finder
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
