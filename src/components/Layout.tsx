import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import type { Message } from '../types';
import { supabase } from '../lib/supabase';
import '../App.css';

const navLinks = [
  { to: '/lost', label: 'Marketplace' },
  { to: '/found', label: 'Post Found' },
];

export const Layout = ({ children }: { children: ReactNode }) => {
  const {
    user,
    signOut,
    signIn,
    error,
    notice,
    isDemo,
    authDialogOpen,
    closeAuthDialog,
    submitEmail,
  } = useAuth();
  const { fetchUnreadMessages, markThreadRead } = useData();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unread, setUnread] = useState<Message[]>([]);
  const [showBell, setShowBell] = useState(false);
  const channelRef = useRef<
    ReturnType<NonNullable<typeof supabase>['channel']> | null
  >(null);

  const handleOpenAuth = () => {
    setEmail('');
    void signIn();
  };

  const handleCloseAuth = () => {
    setEmail('');
    closeAuthDialog();
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    await submitEmail(email);
    setSubmitting(false);
    setEmail('');
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setUnread([]);
        return;
      }
      const data = await fetchUnreadMessages(user.id);
      if (!cancelled) setUnread(data);
    };
    void load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, fetchUnreadMessages]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) return;
    const channel = client
      .channel(`unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setUnread((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev];
          });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
      }
    };
  }, [user?.id]);

  const otherUserFromMessage = (msg: Message) =>
    msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">MAC</span>
          <span className="brand-text">FIND</span>
        </Link>
        <nav className="nav-links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            type="button"
            className="icon-button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {user ? (
            <>
              <div className="user-profile-summary">
                <span className="user-avatar">
                   {(user.email || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="user-name">
                  {user.email?.split('@')[0]}
                </span>
              </div>
              <div className="notification">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowBell((prev) => !prev)}
                  aria-label="Unread messages"
                >
                  🔔
                  {unread.length > 0 && (
                    <span className="badge-counter">{unread.length}</span>
                  )}
                </button>
                {showBell && (
                  <div className="notification-panel">
                    {unread.length === 0 && <p className="hint">No unread messages.</p>}
                    {unread.slice(0, 5).map((msg) => (
                    <Link
                      key={msg.id}
                      to={`/chat/${msg.item_id}/${otherUserFromMessage(msg)}`}
                      className="notification-item"
                      onClick={() => {
                        setUnread((prev) =>
                          prev.filter((m) => m.id !== msg.id),
                        );
                        void markThreadRead(
                          msg.item_id,
                          otherUserFromMessage(msg),
                          user.id,
                        );
                        setShowBell(false);
                      }}
                    >
                        <div className="notification-title">
                          Chat on item {msg.item_id.slice(0, 6)}...
                        </div>
                        <div className="notification-body">{msg.body.slice(0, 80)}</div>
                      </Link>
                    ))}
                    {unread.length > 5 && (
                      <p className="hint">+{unread.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
              <button className="ghost-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={handleOpenAuth}>
              Log In with MacID
            </button>
          )}

        </div>
      </header>

      {error && !authDialogOpen && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}
      {isDemo && !error && (
        <div className="alert alert-info">
          Demo mode: set Supabase env vars in <code>.env.local</code> to enable McMaster-only email login.
        </div>
      )}

      <main className="page-shell">{children}</main>

      {authDialogOpen && (
        <div className="modal-overlay" onClick={handleCloseAuth}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Continue with McMaster email</h3>
            <p className="hint">
              Enter your <strong>MacID@mcmaster.ca</strong> and we&apos;ll email you a magic link.
            </p>
            <form className="form" onSubmit={handleEmailSubmit}>
              <input
                className="input"
                type="email"
                inputMode="email"
                placeholder="macid@mcmaster.ca"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send login link'}
                </button>
                <button className="ghost-button" type="button" onClick={handleCloseAuth}>
                  Cancel
                </button>
              </div>
            </form>
            {error && <div className="modal-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
