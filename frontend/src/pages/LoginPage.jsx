import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { setAccessToken } from '../auth/authStorage';

export default function LoginPage() {
  const { refreshUser, authDisabled, user, bootstrapped } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bootstrapped) return;
    if (authDisabled) {
      navigate('/', { replace: true });
      return;
    }
    if (user) {
      navigate(from, { replace: true });
    }
  }, [bootstrapped, authDisabled, user, from, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      if (!data?.token) {
        setError('Unexpected response from server.');
        return;
      }
      setAccessToken(data.token);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.friendlyMessage || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '8vh' }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            className="logo"
            style={{
              margin: '0 auto 12px',
              width: 48,
              height: 48,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              color: '#f8fafc',
              background: 'linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%)',
            }}
          >
            FA
          </div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>
            Fin-Agri Score
          </h1>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Sign in with your workspace account. Demo seed: <code>loan.officer</code> / <code>officer123</code>
          </p>
        </div>

        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="stack-sm">
          <label className="field">
            <span className="field-label">Username</span>
            <input
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-faint" style={{ marginTop: 20, marginBottom: 0, textAlign: 'center' }}>
          If your API has no <code>JWT_SECRET</code>, the backend runs in open mode and you are redirected into the app
          automatically.
        </p>
      </div>
    </div>
  );
}
