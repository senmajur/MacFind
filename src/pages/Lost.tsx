import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ItemCard } from '../components/ItemCard';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { ItemFilters } from '../types';

const timeRanges = [
  { label: 'Any time', value: 'all' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last week', value: 'week' },
];

export const LostPage = () => {
  const navigate = useNavigate();
  const { items, refreshItems, loading } = useData();
  const { user, signIn } = useAuth();
  const [filters, setFilters] = useState<ItemFilters>({
    status: 'found',
    timeRange: 'week',
  });

  useEffect(() => {
    document.body.classList.add('landing-body');
    return () => {
      document.body.classList.remove('landing-body');
    };
  }, []);

  useEffect(() => {
    void refreshItems(filters);
  }, [filters, refreshItems]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: event.target.value }));
  };

  const handleTagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({
      ...prev,
      tag: event.target.value,
    }));
  };

  const handleLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, location: event.target.value }));
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      timeRange: event.target.value as ItemFilters['timeRange'],
    }));
  };

  const handleCardClick = (id: string) => {
    navigate(`/items/${id}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="pill">Search marketplace</p>
          <h2>Look for your lost item</h2>
          <p className="lede">
            Blurred thumbnails, AI vague labels, and campus-only chat make it feel like a mini Kijiji for McMaster.
          </p>
        </div>
        {!user && (
          <button className="primary-button" onClick={() => void signIn('/lost')}>
            Log in to claim
          </button>
        )}
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder='Search "airpods", "hoodie", "keys"...'
          value={filters.search ?? ''}
          onChange={handleSearchChange}
        />
        <input
          className="input"
          placeholder="Filter by tags (red, hoodie, technology...)"
          value={filters.tag ?? ''}
          onChange={handleTagChange}
        />
        <input
          className="input"
          placeholder="Location found at (MUSC, Mills, ETB...)"
          value={filters.location ?? ''}
          onChange={handleLocationChange}
        />
        <select
          className="input"
          value={filters.timeRange ?? 'all'}
          onChange={handleTimeChange}
        >
          {timeRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card">Loading items...</div>
      ) : (
        <div className="grid">
          {items.length === 0 && (
            <div className="card">
              <h3>No items yet</h3>
              <p>Try a wider time range or different keyword.</p>
            </div>
          )}
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => handleCardClick(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
};
