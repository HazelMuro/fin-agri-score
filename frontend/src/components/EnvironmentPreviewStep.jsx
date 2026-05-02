import { useEffect, useState } from 'react';
import api from '../services/api';

export default function EnvironmentPreviewStep({ farmerId, onConfirm, submitting }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!farmerId) return;
    setLoading(true);
    api.get(`/farmers/${farmerId}/environment-preview`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error?.message || 'Failed to fetch environmental data.'))
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) {
    return (
      <div className="state" style={{ padding: '40px 0' }}>
        <div className="spinner" />
        <p className="mt-2 text-muted">Fetching satellite data for farmer's location…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <strong>Error:</strong> {error}
        <p className="text-sm mt-2">Please ensure the farmer's district and province are correctly set in Step 1.</p>
      </div>
    );
  }

  if (!data) return null;

  const { data: env, meta } = data;

  return (
    <div className="stack">
      <div className="banner is-info mb-4">
        Satellite data resolved for <strong>{meta.latitude}, {meta.longitude}</strong> 
        ({meta.agroEcoZone || 'Unknown agro-ecological zone'}).
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="result-section-label">Rainfall (NASA POWER)</div>
          <div className="kv-grid">
            <div className="kv">
              <span className="k">Rainfall 30d</span>
              <span className="v">{env.rainfall30dMm} mm</span>
            </div>
            <div className="kv">
              <span className="k">Rainfall 90d</span>
              <span className="v">{env.rainfall90dMm} mm</span>
            </div>
            <div className="kv">
              <span className="k">Rainfall Anomaly</span>
              <span className="v">{(env.rainfallAnomaly * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="result-section-label">Vegetation (Estimated)</div>
          <div className="kv-grid">
            <div className="kv">
              <span className="k">NDVI 90d Mean</span>
              <span className="v">{env.ndvi90dMean.toFixed(3)}</span>
            </div>
            <div className="kv">
              <span className="k">NDVI Variability</span>
              <span className="v">{env.ndvi90dStd.toFixed(3)}</span>
            </div>
            <div className="kv">
              <span className="k">Environment Risk</span>
              <span className="v" style={{ 
                color: env.environmentRisk === 'Low' ? 'var(--color-risk-low)' : 
                       env.environmentRisk === 'High' ? 'var(--color-risk-high)' : 'var(--color-risk-medium)',
                fontWeight: 700 
              }}>
                {env.environmentRisk}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted mt-2">
        This data is automatically resolved based on the farmer's district and GPS coordinates.
        It will be used as the baseline for all future loan applications for this farmer.
      </p>

      <div className="flex-between mt-4">
        <div />
        <button className="btn" onClick={onConfirm} disabled={submitting}>
          {submitting ? 'Confirming…' : 'Confirm & Continue'}
        </button>
      </div>
    </div>
  );
}
