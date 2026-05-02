import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFarmers } from '../services/farmers';

const PURPOSES = [
  'Seed and fertilizer inputs',
  'Irrigation equipment',
  'Livestock restocking',
  'Farm expansion',
  'Tractor services',
  'Post-harvest storage',
  'Working capital',
];

const SEASONS = ['2024/2025', '2025/2026', '2026/2027'];

export default function ApplicationForm({ onSubmit, submitting, defaultFarmerId, cancelHref }) {
  const [farmers, setFarmers] = useState([]);
  const [form, setForm] = useState({
    farmerId: defaultFarmerId || '',
    amountRequested: '',
    purpose: '',
    season: '2025/2026',
    caseNotes: '',
  });

  useEffect(() => {
    listFarmers({ take: 200 })
      .then((r) => setFarmers(r.items || []))
      .catch(() => setFarmers([]));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const notes = form.caseNotes.trim();
    const purpose = notes ? `${form.purpose}\n\nCase notes: ${notes}` : form.purpose;
    onSubmit({
      farmerId: form.farmerId,
      amountRequested: Number(form.amountRequested),
      purpose,
      season: form.season,
    });
  };

  const disabled =
    submitting || !form.farmerId || !form.purpose || !form.amountRequested;

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div>
        <div className="section-title">1 · Farmer</div>
        <div className="field">
          <label className="field-label">Select farmer *</label>
          <select className="select" value={form.farmerId} onChange={set('farmerId')} required>
            <option value="">Choose a registered farmer…</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fullName} — {f.district || 'n/a'}
              </option>
            ))}
          </select>
          <div className="field-hint">
            Not listed? Register the farmer first, then come back here.
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">2 · Loan details</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Amount requested (USD) *</label>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={form.amountRequested}
              onChange={set('amountRequested')}
              placeholder="e.g. 1500"
              required
            />
          </div>
          <div className="field">
            <label className="field-label">Season</label>
            <select className="select" value={form.season} onChange={set('season')}>
              {SEASONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field field-full">
            <label className="field-label">Purpose *</label>
            <select className="select" value={form.purpose} onChange={set('purpose')} required>
              <option value="">Select purpose…</option>
              {PURPOSES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <div className="field-hint">
              This is what the money will be used for. It also helps frame the scoring context.
            </div>
          </div>
          <div className="field field-full">
            <label className="field-label">Case notes</label>
            <textarea 
              className="input" 
              value={form.caseNotes} 
              onChange={set('caseNotes')} 
              placeholder="Any additional information or context for this application..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex-between" style={{ marginTop: 8 }}>
        <div className="text-xs text-faint">* required fields</div>
        <div className="flex gap-2 items-center">
          {cancelHref ? (
            <Link className="btn btn-secondary" to={cancelHref}>
              Cancel
            </Link>
          ) : null}
          <button className="btn" type="submit" disabled={disabled}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </div>
    </form>
  );
}
