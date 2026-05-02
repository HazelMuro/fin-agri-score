import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FarmerForm from '../components/FarmerForm';
import FarmActivityForm from '../components/FarmActivityForm';
import SocialCapitalForm from '../components/SocialCapitalForm';
import HouseholdIncomeForm from '../components/HouseholdIncomeForm';
import EnvironmentPreviewStep from '../components/EnvironmentPreviewStep';
import { createFarmer } from '../services/farmers';
import {
  createFarmActivity,
  createSocialCapital,
  upsertHouseholdIncome,
} from '../services/assessment';

const STEPS = [
  { id: 1, label: 'Personal & location' },
  { id: 2, label: 'Household income' },
  { id: 3, label: 'Farm activity' },
  { id: 4, label: 'Social capital' },
  { id: 5, label: 'Environmental context' },
  { id: 6, label: 'Complete profile' },
];

export default function FarmerOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [farmer, setFarmer] = useState(null);
  const [incomePrefill, setIncomePrefill] = useState(null);
  const [householdSaved, setHouseholdSaved] = useState(false);
  const [activitySaved, setActivitySaved] = useState(false);
  const [socialSaved, setSocialSaved] = useState(false);
  const [envSaved, setEnvSaved] = useState(false);

  const completeness = useMemo(() => {
    const flags = [
      !!farmer?.id,
      householdSaved,
      activitySaved,
      socialSaved,
      envSaved,
    ];
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  }, [farmer, householdSaved, activitySaved, socialSaved, envSaved]);

  const maxUnlockedStep = useMemo(() => {
    if (!farmer?.id) return 1;
    if (!householdSaved) return 2;
    if (!activitySaved) return 3;
    if (!socialSaved) return 4;
    if (!envSaved) return 5;
    return 6;
  }, [farmer, householdSaved, activitySaved, socialSaved, envSaved]);

  const next = () => setStep((s) => Math.min(6, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleFarmerCreate = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      const { monthlyHouseholdIncome, ...farmerPayload } = payload;
      const created = await createFarmer(farmerPayload);

      if (monthlyHouseholdIncome != null && !Number.isNaN(Number(monthlyHouseholdIncome))) {
        await upsertHouseholdIncome({
          farmerId: created.id,
          mainSource: 'Household income (registration)',
          mainAmount: Number(monthlyHouseholdIncome),
        });
        setIncomePrefill(Number(monthlyHouseholdIncome));
        setHouseholdSaved(true);
      }

      setFarmer(created);
      setToast('Farmer profile created. Continue with assessment details.');
      setStep(2);
    } catch (e) {
      setError(e.friendlyMessage || 'Failed to create farmer profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Farmer Registration</h1>
          <p className="page-subtitle">
            Guided onboarding for a complete, score-ready farmer profile.
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="stepper">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`step ${s.id === step ? 'is-active' : s.id < step ? 'is-done' : ''}`}
              onClick={() => setStep(Math.min(s.id, maxUnlockedStep))}
            >
              <span className="step-num">{s.id}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <div className="flex-between text-sm mb-2">
            <span className="text-muted">Onboarding completeness</span>
            <strong>{completeness}%</strong>
          </div>
          <div className={`progress ${completeness < 50 ? 'progress-danger' : completeness < 75 ? 'progress-warning' : ''}`}>
            <span style={{ width: `${completeness}%` }} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {toast && <div className="alert alert-success mb-4">{toast}</div>}

      {step === 1 && (
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Step 1 · Personal & location</h2>
          </div>
          <FarmerForm onSubmit={handleFarmerCreate} submitting={saving} />
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Step 2 · Household income</h2>
          </div>
          <HouseholdIncomeForm
            farmerId={farmer?.id}
            initial={
              incomePrefill != null
                ? { mainAmount: incomePrefill, mainSource: 'Other' }
                : {}
            }
            upsertFn={async (payload) => {
              const saved = await upsertHouseholdIncome(payload);
              setHouseholdSaved(true);
              setToast('Household income saved.');
              return saved;
            }}
            submitting={saving}
          />
          <div className="step-footer">
            <button className="btn btn-secondary" onClick={back}>← Back</button>
            <button className="btn" onClick={next} disabled={!householdSaved}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Step 3 · Farm activity</h2>
          </div>
          <FarmActivityForm
            farmerId={farmer?.id}
            createFn={async (payload) => {
              const saved = await createFarmActivity(payload);
              setActivitySaved(true);
              setToast('Farm activity saved.');
              return saved;
            }}
            submitting={saving}
          />
          <div className="step-footer">
            <button className="btn btn-secondary" onClick={back}>← Back</button>
            <button className="btn" onClick={next} disabled={!activitySaved}>Next →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Step 4 · Social capital</h2>
          </div>
          <SocialCapitalForm
            farmerId={farmer?.id}
            createFn={async (payload) => {
              const saved = await createSocialCapital(payload);
              setSocialSaved(true);
              setToast('Social capital saved.');
              return saved;
            }}
            submitting={saving}
          />
          <div className="step-footer">
            <button className="btn btn-secondary" onClick={back}>← Back</button>
            <button className="btn" onClick={next} disabled={!socialSaved}>Next →</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Step 5 · Environmental context</h2>
          </div>
          <EnvironmentPreviewStep
            farmerId={farmer?.id}
            onConfirm={() => {
              setEnvSaved(true);
              setToast('Environmental context confirmed.');
              setStep(6);
            }}
            submitting={saving}
          />
          <div className="step-footer mt-4">
            <button className="btn btn-secondary" onClick={back}>← Back</button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="card">
          <h2>Step 6 · Complete profile</h2>
          <p className="text-muted">
            Farmer onboarding is complete. Next, create a loan application and continue to readiness and scoring.
          </p>
          <div className="checklist mt-3">
            <div className={`checklist-item ${farmer?.id ? 'is-ok' : 'is-missing'}`}>
              <span style={{ fontWeight: 700 }}>{farmer?.id ? '✓' : '✗'}</span>
              <div>Farmer profile</div>
            </div>
            <div className={`checklist-item ${householdSaved ? 'is-ok' : 'is-partial'}`}>
              <span style={{ fontWeight: 700 }}>{householdSaved ? '✓' : '◐'}</span>
              <div>Household income</div>
            </div>
            <div className={`checklist-item ${activitySaved ? 'is-ok' : 'is-partial'}`}>
              <span style={{ fontWeight: 700 }}>{activitySaved ? '✓' : '◐'}</span>
              <div>Farm activity</div>
            </div>
            <div className={`checklist-item ${socialSaved ? 'is-ok' : 'is-partial'}`}>
              <span style={{ fontWeight: 700 }}>{socialSaved ? '✓' : '◐'}</span>
              <div>Social capital</div>
            </div>
            <div className={`checklist-item ${envSaved ? 'is-ok' : 'is-partial'}`}>
              <span style={{ fontWeight: 700 }}>{envSaved ? '✓' : '◐'}</span>
              <div>Environmental context</div>
            </div>
          </div>
          <div className="step-footer mt-4">
            <button className="btn btn-secondary" onClick={back}>← Back</button>
            <button
              className="btn"
              onClick={() => navigate(`/farmers/${farmer.id}`)}
              disabled={!farmer?.id}
            >
              Open farmer profile →
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/applications/new?farmerId=${farmer.id}`)}
              disabled={!farmer?.id}
            >
              Create application →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

