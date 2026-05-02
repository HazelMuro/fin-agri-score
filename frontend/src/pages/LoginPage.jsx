import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { setAccessToken } from '../auth/authStorage';
import api from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      setAccessToken(data.token);
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.friendlyMessage || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-surface-alt)' }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff',
            fontSize: 24, fontWeight: 'bold', marginBottom: '1rem'
          }}>
            FA
          </div>
          <h1 style={{ margin: 0 }}>Fin-Agri Score</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Log in to your account</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="stack">
          <div className="field">
            <label className="field-label">Username</label>
            <input 
              className="input" 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Enter your username" 
            />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter your password" 
            />
          </div>
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
