import { useState } from 'react';

const CROPS = [
  'Maize', 'Tobacco', 'Groundnuts', 'Cotton', 'Soya Bean',
  'Sorghum', 'Millet', 'Wheat', 'Horticulture', 'Other',
];
const IRRIGATION = ['No', 'Partial', 'Yes'];
const INPUT_USAGE = ['None', 'Low', 'Medium', 'High'];

export default function FarmActivityForm({ farmerId, onSaved, submitting, createFn, compact = false }) {
  const [form, setForm] = useState({
    cropType: '',
    estimatedYield: '',
    irrigation: '',
    season: '2025/2026',
    inputUsage: '',
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const payload = {
        farmerId,
        cropType: form.cropType || undefined,
        estimatedYield: form.estimatedYield ? Number(form.estimatedYield) : undefined,
        irrigation: form.irrigation || undefined,
        season: form.season || undefined,
        inputUsage: form.inputUsage || undefined,
      };
      const saved = await createFn(payload);
      onSaved?.(saved);
    } catch (e2) {
      setErr(e2.friendlyMessage || 'Failed to save');
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      {!compact && <div className="section-title">Farm activity</div>}
      <div className="form-grid">
        <div className="field">
          <label className="field-label">Main crop *</label>
          <select className="select" value={form.cropType} onChange={set('cropType')} required>
            <option value="">Select…</option>
            {CROPS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Estimated yield (t/ha) *</label>
          <input className="input" type="number" step="0.1" value={form.estimatedYield} onChange={set('estimatedYield')} required placeholder="e.g. 2.5" />
        </div>
        <div className="field">
          <label className="field-label">Irrigation access *</label>
          <select className="select" value={form.irrigation} onChange={set('irrigation')} required>
            <option value="">Select…</option>
            {IRRIGATION.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Input usage level *</label>
          <select className="select" value={form.inputUsage} onChange={set('inputUsage')} required>
            <option value="">Select…</option>
            {INPUT_USAGE.map((i) => <option key={i}>{i}</option>)}
          </select>
          <div className="field-hint">Fertilizer, improved seed, agro-chemicals.</div>
        </div>
        <div className="field">
          <label className="field-label">Season</label>
          <select className="select" value={form.season} onChange={set('season')}>
            <option>2024/2025</option>
            <option>2025/2026</option>
            <option>2026/2027</option>
          </select>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      <div className="flex-between" style={{ marginTop: 8 }}>
        <div className="text-xs text-faint">* required</div>
        <button className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save farm activity'}
        </button>
      </div>
    </form>
  );
}
