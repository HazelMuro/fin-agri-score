import { useState, useMemo } from 'react';

const INCOME_SOURCES = [
  'Crop sales (Grain/Hort)',
  'Livestock trade',
  'Mixed farming revenue',
  'Agri-processing / Value add',
  'Casual farm labour',
  'Small trade / Shop',
  'Remittances (Family support)',
  'Pension / Grant',
  'None',
];

const OFFICIAL_PRICES = {
  'Maize (GMB)': 335,
  'Tobacco': 3500,
  'Cotton': 500,
  'Sorghum/Small Grains': 335,
  'Horticulture (Avg)': 800,
  'Cattle': 600,
  'Goats/Sheep': 80,
  'Poultry (per 100)': 500,
};

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
  const [showCalc, setShowCalc] = useState(false);
  const [calc, setCalc] = useState({
    type: 'crop', // 'crop', 'livestock', or 'mixed'
    yieldTons: 0,
    consTons: 1,
    cropType: 'Maize (GMB)',
    animalCount: 0,
    animalType: 'Cattle',
    offtakeRate: 10,
  });

  const set = (k) => (e) => {
    const val = e.target.value;
    setForm({ ...form, [k]: val });
    
    // Smart Toggle Logic
    if (k === 'mainSource') {
      if (val.includes('Crop')) { setCalc(c => ({...c, type: 'crop'})); setShowCalc(true); }
      else if (val.includes('Livestock')) { setCalc(c => ({...c, type: 'livestock'})); setShowCalc(true); }
      else if (val.includes('Mixed')) { setCalc(c => ({...c, type: 'mixed'})); setShowCalc(true); }
    }
  };

  const setC = (k) => (e) => setCalc({ ...calc, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const calculatedRevenue = useMemo(() => {
    let cropRev = 0;
    let liveRev = 0;

    if (calc.type === 'crop' || calc.type === 'mixed') {
      const surplus = Math.max(0, calc.yieldTons - calc.consTons);
      cropRev = (surplus * (OFFICIAL_PRICES[calc.cropType] || 335));
    }
    
    if (calc.type === 'livestock' || calc.type === 'mixed') {
      const annualSale = calc.animalCount * (calc.offtakeRate / 100);
      liveRev = (annualSale * (OFFICIAL_PRICES[calc.animalType] || 400));
    }

    return Math.round((cropRev + liveRev) / 12);
  }, [calc]);

  const applyCalc = () => {
    setForm({ ...form, mainAmount: calculatedRevenue });
    setShowCalc(false);
  };

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
    <div className="stack">
      {showCalc && (
        <div className="card mb-4" style={{ background: 'var(--color-surface-alt)', border: '2px dashed var(--color-primary-200)', padding: '20px' }}>
          <div className="flex-between mb-3">
            <h3 style={{ margin: 0, color: 'var(--color-navy)' }}>
              {calc.type === 'mixed' ? 'Mixed Farming Calculator' : calc.type === 'livestock' ? 'Livestock Revenue Estimator' : 'Crop Revenue Estimator'}
            </h3>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowCalc(false)}>Close</button>
          </div>
          
          <p className="text-xs text-muted mb-4">
            Calculates marketable surplus and sustainable off-take using official market prices.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: calc.type === 'mixed' ? '1fr 1fr' : '1fr', gap: '24px' }}>
            
            {/* Crop Section */}
            {(calc.type === 'crop' || calc.type === 'mixed') && (
              <div className="stack-sm" style={{ padding: calc.type === 'mixed' ? '12px' : '0', background: calc.type === 'mixed' ? 'rgba(0,0,0,0.02)' : 'none', borderRadius: '8px' }}>
                <div className="section-title" style={{ fontSize: '12px', marginBottom: '8px' }}>Crop Production</div>
                <div className="field">
                  <label className="field-label">Crop Type</label>
                  <select className="select" value={calc.cropType} onChange={setC('cropType')}>
                    {Object.keys(OFFICIAL_PRICES).filter(k => !['Cattle', 'Goats/Sheep', 'Poultry (per 100)'].includes(k)).map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Total Yield (Tons)</label>
                  <input className="input" type="number" value={calc.yieldTons} onChange={setC('yieldTons')} />
                </div>
                <div className="field">
                  <label className="field-label">Home Cons. (Tons)</label>
                  <input className="input" type="number" value={calc.consTons} onChange={setC('consTons')} />
                </div>
                <div className="text-xs text-muted mt-1">Price: ${OFFICIAL_PRICES[calc.cropType]}/ton</div>
              </div>
            )}

            {/* Livestock Section */}
            {(calc.type === 'livestock' || calc.type === 'mixed') && (
              <div className="stack-sm" style={{ padding: calc.type === 'mixed' ? '12px' : '0', background: calc.type === 'mixed' ? 'rgba(0,0,0,0.02)' : 'none', borderRadius: '8px' }}>
                <div className="section-title" style={{ fontSize: '12px', marginBottom: '8px' }}>Livestock Assets</div>
                <div className="field">
                  <label className="field-label">Animal Type</label>
                  <select className="select" value={calc.animalType} onChange={setC('animalType')}>
                    <option>Cattle</option>
                    <option>Goats/Sheep</option>
                    <option>Poultry (per 100)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Head Count</label>
                  <input className="input" type="number" value={calc.animalCount} onChange={setC('animalCount')} />
                </div>
                <div className="field">
                  <label className="field-label">Annual Off-take (%)</label>
                  <input className="input" type="number" value={calc.offtakeRate} onChange={setC('offtakeRate')} />
                </div>
                <div className="text-xs text-muted mt-1">Price: ${OFFICIAL_PRICES[calc.animalType]}/head</div>
              </div>
            )}

          </div>

          <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--color-primary-600)', color: 'white' }}>
            <div className="flex-between">
              <div>
                <div className="text-xs uppercase font-bold" style={{ opacity: 0.8 }}>Total Est. Monthly Cash Flow</div>
                <div style={{ fontSize: '28px', fontWeight: 800 }}>${calculatedRevenue} <span style={{ fontSize: '14px', fontWeight: 400, opacity: 0.7 }}>/ month</span></div>
              </div>
              <button className="btn" style={{ background: 'white', color: 'var(--color-primary-600)' }} onClick={applyCalc}>
                Apply to Form
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="stack">
      <div>
        <div className="section-title">Primary Revenue Stream</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Primary revenue source *</label>
            <select className="select" value={form.mainSource} onChange={set('mainSource')} required>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <div className="flex-between" style={{ marginBottom: 4 }}>
              <label className="field-label" style={{ margin: 0 }}>Est. monthly cash flow (USD) *</label>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowCalc(!showCalc)}>
                {showCalc ? 'Close Estimator' : '🧮 Open Revenue Estimator'}
              </button>
            </div>
            <input className="input" type="number" min="0" step="any" value={form.mainAmount} onChange={set('mainAmount')} required placeholder="e.g. 180" />
            <div className="field-hint">Average monthly revenue generated from this source (after input costs).</div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Supplementary Revenue (optional)</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Secondary revenue source</label>
            <select className="select" value={form.secondarySource} onChange={set('secondarySource')}>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Secondary revenue (USD)</label>
            <input className="input" type="number" min="0" step="any" value={form.secondaryAmount} onChange={set('secondaryAmount')} />
          </div>
          <div className="field">
            <label className="field-label">Tertiary revenue source</label>
            <select className="select" value={form.thirdSource} onChange={set('thirdSource')}>
              <option value="">Select…</option>
              {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Tertiary revenue (USD)</label>
            <input className="input" type="number" min="0" step="any" value={form.thirdAmount} onChange={set('thirdAmount')} />
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
          {submitting ? 'Saving…' : 'Save revenue profile'}
        </button>
      </div>
      </form>
    </div>
  );
}
