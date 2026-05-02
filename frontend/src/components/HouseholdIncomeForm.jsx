import { useState } from 'react';

const INCOME_SOURCES = [
  'Crop farming',
  'Livestock',
  'Mixed farming',
  'Casual labour',
  'Salaried employment',
  'Small business',
  'Remittances',
  'Pension / grant',
  'Other',
  'None',
];

const COPING_LEVELS = [
  { v: 1, label: '1 · No stress strategies used' },
  { v: 2, label: '2 · Stress strategies only' },
  { v: 3, label: '3 · Crisis strategies' },
  { v: 4, label: '4 · Emergency strategies' },
];

export default function HouseholdIncomeForm({ farmerId, initial = {}, onSaved, submitting, upsertFn }) {
  const [form, setForm] = useState({
    mainSource: initial.mainSource || '',
    mainAmount: initial.mainAmount ?? '',
    secondarySource: initial.secondarySource || '',
    secondaryAmount: initial.secondaryAmount ?? '',
    thirdSource: initial.thirdSource || '',
    thirdAmount: initial.thirdAmount ?? '',
    shockExperienced: initial.shockExperienced ? 'Yes' : 'No',
    copingIndex: initial.copingIndex ?? 1,
    dietaryDiversity: initial.dietaryDiversity ?? '',
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const payload = {
        farmerId,
        mainSource: form.mainSource || undefined,
        mainAmount: form.mainAmount !== '' ? Number(form.mainAmount) : undefined,
        secondarySource: form.secondarySource || undefined,
        secondaryAmount: form.secondaryAmount !== '' ? Number(form.secondaryAmount) : undefined,
        thirdSource: form.thirdSource || undefined,
        thirdAmount: form.thirdAmount !== '' ? Number(form.thirdAmount) : undefined,
        shockExperienced: form.shockExperienced === 'Yes',
        copingIndex: Number(form.copingIndex) || 1,
        dietaryDiversity: form.dietaryDiversity !== '' ? Number(form.dietaryDiversity) : undefined,
      };
      const saved = await upsertFn(payload);
      onSaved?.(saved);
    } catch (e2) {
      setErr(e2.friendlyMessage || 'Failed to save');
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div>
        <div className="section-title">Primary income</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Main income source *</label>
            <select className="select" value={form.mainSource} onChange={set('mainSource')} required>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Main monthly income (USD) *</label>
            <input className="input" type="number" min="0" step="10" value={form.mainAmount} onChange={set('mainAmount')} required placeholder="e.g. 180" />
            <div className="field-hint">Approximate monthly income from the main source.</div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Additional income (optional)</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Secondary source</label>
            <select className="select" value={form.secondarySource} onChange={set('secondarySource')}>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Secondary amount (USD)</label>
            <input className="input" type="number" min="0" step="10" value={form.secondaryAmount} onChange={set('secondaryAmount')} />
          </div>
          <div className="field">
            <label className="field-label">Third source</label>
            <select className="select" value={form.thirdSource} onChange={set('thirdSource')}>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Third amount (USD)</label>
            <input className="input" type="number" min="0" step="10" value={form.thirdAmount} onChange={set('thirdAmount')} />
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Household resilience</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Recent economic / climate shock?</label>
            <select className="select" value={form.shockExperienced} onChange={set('shockExperienced')}>
              <option>No</option>
              <option>Yes</option>
            </select>
            <div className="field-hint">
              Drought, pest outbreak, illness, job loss etc. in the last 6 months. Switching this to “Yes” feeds straight into the model’s shock indicators and usually raises credit risk materially compared with “No.” Accurate reporting matters — do not treat this as a minor tweak.
            </div>
          </div>
          <div className="field">
            <label className="field-label">Coping strategy index (1–4)</label>
            <select className="select" value={form.copingIndex} onChange={set('copingIndex')}>
              {COPING_LEVELS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
            <div className="field-hint">Livelihood stress level from the Coping Strategies Index.</div>
          </div>
          <div className="field">
            <label className="field-label">Dietary diversity (0–12)</label>
            <input className="input" type="number" min="0" max="12" value={form.dietaryDiversity} onChange={set('dietaryDiversity')} />
            <div className="field-hint">
              Food groups consumed in the last 24 hours (HDDS-style). In this deployment the dietary figure is mainly for the file summary — it is not yet wired into the live sklearn feature list the same way as shocks and income, so on its own it should not swing the score.
            </div>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      <div className="flex-between" style={{ marginTop: 8 }}>
        <div className="text-xs text-faint">* required</div>
        <button className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save household income'}
        </button>
      </div>
    </form>
  );
}
