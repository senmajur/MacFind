import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    title: 'McMaster-only community',
    detail: 'Email login locked to @mcmaster.ca so every exchange is on campus.',
  },
  {
    title: 'Blurred-by-default photos',
    detail: 'Every thumbnail stays blurred until a claim is approved for safety.',
  },
  {
    title: 'AI-powered matching',
    detail: 'Gemini labels, categories, and color tags to help you search faster.',
  },
  {
    title: 'Built-in chat',
    detail: 'Coordinate handoff spots like MUSC or Mills with a safe chat.',
  },
];

const steps = [
  { label: 'Found an item?', action: 'Post it with a blurred photo + location found at.' },
  { label: 'Lost something?', action: 'Search "airpods", "hoodie", "keys" on the marketplace.' },
  { label: 'Claim + chat', action: 'Send proof, then chat to meet up in a safe campus spot.' },
];

const isSafeRedirect = (value: string) =>
  value.startsWith('/') && !value.startsWith('//') && !value.includes('://');

export const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, isDemo } = useAuth();

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (!redirect) return;
    if (!isSafeRedirect(redirect)) return;
    navigate(redirect, { replace: true });
  }, [location.search, navigate, user]);

  const handleCTA = async (path: string) => {
    if (!user) {
      await signIn(path);
      if (isDemo) navigate(path);
      return;
    }
    navigate(path);
  };

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">McMaster Marauders - Lost &amp; Found</span>
          <h1>Find lost items on campus - fast, safe, McMaster-only.</h1>
          <p className="lede">
            MACFIND is a campus-only lost &amp; found marketplace with blurred photos,
            AI tagging, and built-in chat so you can reunite items without guesswork.
          </p>
          <div className="cta-row">
            <button className="primary-button" onClick={() => void signIn()}>
              Continue with McMaster email
            </button>
            <button className="ghost-button" onClick={() => void handleCTA('/lost')}>
              I lost an item
            </button>
            <button className="accent-button" onClick={() => void handleCTA('/found')}>
              I found an item
            </button>
          </div>
          <div className="subtext">
            <strong>McMaster-only.</strong> Photos stay blurred in the feed. AI labels improve
            search. Chat to set a safe meetup (MUSC, Mills, ETB).
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card__header">
            <div>
              <div className="mini-title">Live marketplace</div>
              <div className="mini-subtitle">blurred thumbnails - AI tags - chat ready</div>
            </div>
            <div className="status-dot">LIVE</div>
          </div>
          <div className="hero-grid">
            <div className="hero-item">
              <div className="blurred-thumb" />
              <div className="hero-item__body">
                <div className="hero-item__title">"white apple airpods"</div>
                <div className="chips">
                  <span className="chip">Electronics</span>
                  <span className="chip">MUSC</span>
                  <span className="chip chip-soft">Found</span>
                </div>
              </div>
            </div>
            <div className="hero-item">
              <div className="blurred-thumb" />
              <div className="hero-item__body">
                <div className="hero-item__title">"maroon hoodie"</div>
                <div className="chips">
                  <span className="chip">Clothing</span>
                  <span className="chip">Mills</span>
                  <span className="chip chip-soft">Found</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-footer">
            <div>
              <div className="mini-title">AI assist</div>
              <div className="mini-subtitle">Gemini auto-labels photos for faster matching.</div>
            </div>
            <div className="pill pill-gold">Blurred by default</div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.detail}</p>
          </div>
        ))}
      </section>

      <section className="steps">
        <h2>How it works</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div key={step.label} className="step-card">
              <div className="step-number">{index + 1}</div>
              <div>
                <div className="step-label">{step.label}</div>
                <div className="step-action">{step.action}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
