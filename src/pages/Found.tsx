import { useMemo, useState } from 'react';
import { ItemCard } from '../components/ItemCard';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../types';

const campusLocations = [
  'MUSC',
  'Mills Library',
  'ETB',
  'Health Sciences',
  'Togo Salmon Hall',
  'LR Wilson',
  'Commons',
];

const colorWords = [
  'red',
  'blue',
  'green',
  'black',
  'white',
  'gray',
  'grey',
  'gold',
  'silver',
  'maroon',
  'yellow',
  'pink',
  'purple',
  'brown',
  'orange',
];

const categoryKeywords: Array<{ match: RegExp; tag: string }> = [
  { match: /(airpods|earbud|headphone|laptop|phone|charger|tech)/i, tag: 'technology' },
  { match: /(hoodie|jacket|coat|shirt|glove|hat|cap|scarf|shoe)/i, tag: 'clothing' },
  { match: /(card|student card|id)/i, tag: 'id' },
  { match: /(key|keys|fob)/i, tag: 'keys' },
  { match: /(bottle|water)/i, tag: 'water bottle' },
  { match: /(book|textbook|notebook)/i, tag: 'book' },
  { match: /(bag|backpack|purse|tote)/i, tag: 'bag' },
  { match: /(ball|cleat|sport|gym)/i, tag: 'sports' },
];

const buildSuggestedTags = (
  description: string,
  filename?: string | null,
  location?: string,
) => {
  const text = `${description} ${filename ?? ''} ${location ?? ''}`.toLowerCase();
  const tags = new Set<string>();

  colorWords.forEach((color) => {
    if (text.includes(color)) tags.add(color);
  });

  categoryKeywords.forEach(({ match, tag }) => {
    if (match.test(text)) tags.add(tag);
  });

  if (location?.toLowerCase().includes('musc')) tags.add('musc');
  if (location?.toLowerCase().includes('mills')) tags.add('mills');
  tags.add('found');
  tags.add('campus');

  return Array.from(tags).slice(0, 8);
};

export const FoundPage = () => {
  const { user, requireLogin } = useAuth();
  const { postFound, items, refreshItems, deleteItem } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [locationFoundAt, setLocationFoundAt] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const myItems = useMemo<Item[]>(() => {
    if (!user) return [];
    let localIds = new Set<string>();
    try {
      const raw = localStorage.getItem(`macfind:my-item-ids:${user.id}`);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed)) {
        localIds = new Set(
          parsed.filter((value): value is string => typeof value === 'string'),
        );
      }
    } catch {
      // ignore
    }
    return items.filter(
      (item) => item.owner_id === user.id || localIds.has(item.id),
    );
  }, [items, user]);

  const suggestedTags = useMemo(
    () =>
      buildSuggestedTags(
        description,
        file?.name ?? null,
        locationFoundAt,
      ),
    [description, file?.name, locationFoundAt],
  );

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (!clean) return;
    setSelectedTags((prev) => Array.from(new Set([...prev, clean])));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((value) => value !== tag));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setManageMessage(null);
    if (!requireLogin('/found')) return;
    if (!file) {
      setMessage('Please upload a photo to post.');
      return;
    }
    setSubmitting(true);
    const result = await postFound(
      {
        file,
        locationFoundAt,
        description,
        tags: selectedTags,
        suggestedTags,
      },
      user,
    );
    if (result) {
      setMessage('Posted! Your item is now in the marketplace.');
      setFile(null);
      setLocationFoundAt('');
      setDescription('');
      setSelectedTags([]);
      await refreshItems({ status: 'found' });
    } else {
      setMessage('Could not post item. Check console for details.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (itemId: string) => {
    setManageMessage(null);
    if (!requireLogin('/found')) return;
    const confirmed = window.confirm('Delete this post?');
    if (!confirmed) return;
    setDeletingId(itemId);
    const success = await deleteItem(itemId, user);
    setDeletingId(null);
    if (success) {
      setManageMessage('Post deleted.');
    } else {
      setManageMessage('Could not delete that post. Please try again.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="pill">Found dashboard</p>
          <h2>Post a found item & manage your listings</h2>
          <p className="lede">
            Upload a blurred photo, drop the location found at, and let Gemini auto-label the item for search.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Post found item</h3>
        <form className="form" onSubmit={handleSubmit}>
          <label className="form-label">
            Image (required)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label className="form-label">
            Location found at
            <div className="split">
              <select
                className="input"
                onChange={(e) => setLocationFoundAt(e.target.value)}
                value={locationFoundAt}
              >
                <option value="">Select spot</option>
                {campusLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Extra details (near Starbucks, 3rd floor...)"
                value={locationFoundAt}
                onChange={(e) => setLocationFoundAt(e.target.value)}
                required
              />
            </div>
          </label>
          <label className="form-label">
            Optional description / quiz hint
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Small sticker on the case, or ask a question for claimers."
            />
          </label>
          <div className="form-label">
            <div>MacFinder recommends you use these tags for categorization of item</div>
            <p className="hint">
              Tags should be general (colors, clothing, technology, etc.). Add, remove, or accept the suggestions below.
            </p>
            <div className="chips">
              {suggestedTags.length === 0 && <span className="hint">No suggestions yet.</span>}
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip chip-soft"
                  onClick={() => addTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="tag-editor">
              <div className="tag-editor__row">
                <div className="chips">
                  {selectedTags.length === 0 && (
                    <span className="hint">No tags selected yet.</span>
                  )}
                  {selectedTags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      <span>{tag}</span>
                      <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button type="button" className="ghost-button" onClick={() => setSelectedTags(suggestedTags)}>
                  Use suggested tags
                </button>
              </div>
              <div className="tag-editor__row">
                <input
                  className="input"
                  placeholder="Add a tag (e.g., red, hoodie, technology)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
                <button type="button" className="accent-button" onClick={() => addTag(tagInput)}>
                  Add tag
                </button>
              </div>
            </div>
          </div>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Posting...' : 'Submit found item'}
          </button>
          {message && <p className="hint">{message}</p>}
        </form>
      </div>

      <div className="section-header">
        <h3>My posted items</h3>
        {!user && <p className="hint">Log in to see your postings.</p>}
      </div>
      {manageMessage && <p className="hint">{manageMessage}</p>}
      <div className="grid">
        {myItems.length === 0 && user && (
          <div className="card">
            <p>No items posted yet.</p>
          </div>
        )}
        {myItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            actions={
              <button
                type="button"
                className="ghost-button danger"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(item.id);
                }}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? 'Deleting...' : 'Delete post'}
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
};
