import { useEffect, useState } from 'react';
import FarmersTable from '../components/FarmersTable';
import { listFarmers } from '../services/farmers';
import { Link, useLocation } from 'react-router-dom';

export default function FarmersPage() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState(null);
  const location = useLocation();

  const load = async (query = '') => {
    setLoading(true);
    try {
      const res = await listFarmers(query ? { q: query } : {});
      setFarmers(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (location.state?.createdFarmerName) {
      setToast({
        kind: 'success',
        msg: `${location.state.createdFarmerName} registered successfully.`,
      });
    }
  }, [location.state]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Farmers</h1>
          <p className="page-subtitle">
            Browse and search registered smallholder farmers, then open a profile to review readiness for lending.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            style={{ width: 260 }}
            placeholder="Search by name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
          />
          <button className="btn btn-secondary" onClick={() => load(q)}>Search</button>
          <Link className="btn" to="/farmers/new">+ Register farmer</Link>
        </div>
      </div>

      {toast && (
        <div
          className="card card-tight mb-4"
          style={{
            borderColor: toast.kind === 'error' ? 'var(--color-risk-high)' : 'var(--color-risk-low)',
            background: toast.kind === 'error' ? 'var(--color-risk-high-bg)' : 'var(--color-risk-low-bg)',
            color: toast.kind === 'error' ? 'var(--color-risk-high)' : 'var(--color-risk-low)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>Registered farmers</h2>
          <span className="badge">{farmers.length} total</span>
        </div>
        {loading ? <div className="state"><div className="spinner" /></div> : <FarmersTable farmers={farmers} />}
      </div>
    </div>
  );
}
