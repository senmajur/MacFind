import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { useState } from 'react';
import '../App.css'; 

const isSafeRedirect = (value: string) =>
  value.startsWith('/') && !value.startsWith('//') && !value.includes('://');

export const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, isDemo } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.body.classList.add('landing-body');
    return () => {
      document.body.classList.remove('landing-body');
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (!redirect) return;
    if (!isSafeRedirect(redirect)) return;
    navigate(redirect, { replace: true });
  }, [location.search, navigate, user]);

  const handleAction = async (path: string) => {
    if (!user) {
      await signIn(path);
      if (isDemo) navigate(path);
      return;
    }
    navigate(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleAction(`/lost?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <h1 className="hero-title">
          Lost something at <span className="highlight-text">Mac?</span>
        </h1>
        <p className="hero-subtitle">
          The official, safe marketplace to reunite with your belongings on campus.
        </p>
        
        <form onSubmit={handleSearch} className="hero-search">
          <input 
            type="text" 
            placeholder="Search e.g. 'AirPods', 'Blue Hoodie'..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>
      </div>

      <div className="action-grid">
        <div className="action-card lost-card" onClick={() => handleAction('/lost')}>
          <div className="card-icon">🔍</div>
          <h2>I Lost Something</h2>
          <p>Browse recent findings or search for your specific item.</p>
          <span className="card-link">Browse Items &rarr;</span>
        </div>

        <div className="action-card found-card" onClick={() => handleAction('/found')}>
          <div className="card-icon">📸</div>
          <h2>I Found Something</h2>
          <p>Snap a photo (it blurs automatically) and help someone out.</p>
          <span className="card-link">Post Item &rarr;</span>
        </div>
      </div>
    </div>
  );
};

