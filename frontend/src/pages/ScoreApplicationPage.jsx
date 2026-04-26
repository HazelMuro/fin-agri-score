/**
 * Score Application — 5-step assessment workflow.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import EnvironmentalMetrics from '../components/EnvironmentalMetrics';
import ExplanationPanel from '../components/ExplanationPanel';
import ScoreCard from '../components/ScoreCard';
import ReadinessChecklist, { DualProgress } from '../components/ReadinessChecklist';
import ArtifactXaiPanel from '../components/ArtifactXaiPanel';
import FarmActivityForm from '../components/FarmActivityForm';
import SocialCapitalForm from '../components/SocialCapitalForm';
import HouseholdIncomeForm from '../components/HouseholdIncomeForm';
import ProvenanceBadge from '../components/ProvenanceBadge';

import { getApplication, listApplications } from '../services/applications';
import { getFarmer } from '../services/farmers';
import { scoreApplication } from '../services/scores';
import {
  getReadiness,
  autofillEnvironment,
  confirmEnvironment,
  editEnvironment,
  createFarmActivity,
  createSocialCapital,
  upsertHouseholdIncome,
} from '../services/assessment';
import {
  getXaiOverview,
  getXaiFeatureImportance,
  getXaiSampleExplanations,
} from '../services/xai';
import { currency, date, datetime } from '../utils/format';
import { downloadPdf, applicationSummaryPdfPath } from '../services/reports';

const STEPS = [
  { id: 1, label: 'Select application' },
  { id: 2, label: 'Farm & household' },
  { id: 3, label: 'Social capital' },
  { id: 4, label: 'Environmental data' },
  { id: 5, label: 'Review & score' },
];

export default function ScoreApplicationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('applicationId') || '';
  const farmerId = searchParams.get('farmerId') || '';
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [appsReadiness, setAppsReadiness] = useState({});
  const [appFilter, setAppFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(initialId);
  const [application, setApplication] = useState(null);
  const [farmer, setFarmer] = useState(null);
  const [readiness, setReadiness] = useState(null);

  const [step, setStep] = useState(initialId ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [scoring, setScoring] = useState(false);
  const [editedSinceLastScore, setEditedSinceLastScore] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [xaiOverview, setXaiOverview] = useState(null);
  const [xaiFeatureImportance, setXaiFeatureImportance] = useState([]);
  const [xaiSampleExplanations, setXaiSampleExplanations] = useState([]);

  const didAutoJumpRef = useRef(false);

  useEffect(() => {
    listApplications({ take: 200, ...(farmerId ? { farmerId } : {}) })
      .then((r) => setApps(r.items || []))
      .catch(() => setApps([]));
  }, [farmerId]);

  useEffect(() => {
    if (!apps.length) {
      setAppsReadiness({});
      return;
    }
    Promise.all(
      apps.map(async (a) => {
        try {
          const r = await getReadiness(a.id);
          return [a.id, r];
        } catch {
          return [a.id, null];
        }
      })
    ).then((pairs) => setAppsReadiness(Object.fromEntries(pairs)));
  }, [apps]);

  useEffect(() => {
    Promise.all([
      getXaiOverview(10),
      getXaiFeatureImportance(10, 0),
      getXaiSampleExplanations(2, 0),
    ])
      .then(([ov, fi, se]) => {
        setXaiOverview(ov);
        setXaiFeatureImportance(fi?.items || []);
        setXaiSampleExplanations(se?.items || []);
      })
      .catch(() => {
        setXaiOverview(null);
        setXaiFeatureImportance([]);
        setXaiSampleExplanations([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setApplication(null);
      setFarmer(null);
      setReadiness(null);
      setScoreResult(null);
      return;
    }
    reloadApp();
  }, [selectedId]);

  async function reloadApp() {
    try {
      const [app, r] = await Promise.all([
        getApplication(selectedId),
        getReadiness(selectedId),
      ]);
      setApplication(app);
      setReadiness(r);
      const f = await getFarmer(app.farmerId);
      setFarmer(f);
      if (didAutoJumpRef.current) return;
      didAutoJumpRef.current = true;
      if (r?.canScore) {
        setStep(5);
      } else if (r?.state === 'needs_review') {
        setStep(4);
      }
    } catch (e) {
      setError(e.friendlyMessage || 'Failed to load application.');
    }
  }

  const chooseApp = (id) => {
    setSelectedId(id);
    const next = {};
    if (id) next.applicationId = id;
    if (farmerId) next.farmerId = farmerId;
    setSearchParams(next);
    didAutoJumpRef.current = false;
    setStep(id ? 2 : 1);
    setScoreResult(null);
    setEditedSinceLastScore(false);
    setError(null);
    setInfo(null);
  };

  const saveActivity = async (payload) => {
    setBusy(true); setError(null);
    try {
      await createFarmActivity(payload);
      setEditedSinceLastScore(true);
      setInfo('Farm activity saved. You can now run/re-run scoring.');
      await reloadApp();
    } catch (e) { setError(e.friendlyMessage || 'Save failed'); }
    finally { setBusy(false); }
    return null;
  };
  const saveSocial = async (payload) => {
    setBusy(true); setError(null);
    try {
      await createSocialCapital(payload);
      setEditedSinceLastScore(true);
      setInfo('Social capital saved. You can now run/re-run scoring.');
      await reloadApp();
    } catch (e) { setError(e.friendlyMessage || 'Save failed'); }
    finally { setBusy(false); }
    return null;
  };
  const saveHousehold = async (payload) => {
    setBusy(true); setError(null);
    try {
      await upsertHouseholdIncome(payload);
      setEditedSinceLastScore(true);
      setInfo('Household income saved. You can now run/re-run scoring.');
      await reloadApp();
    } catch (e) { setError(e.friendlyMessage || 'Save failed'); }
    finally { setBusy(false); }
    return null;
  };

  const runAutofill = async (force = false) => {
    if (!selectedId) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const res = await autofillEnvironment(selectedId, { force });
      if (res.meta?.reused) {
        setInfo('Re-using recent environmental data (auto-fill deduped).');
      } else {
        setEditedSinceLastScore(true);
        setInfo(`Environmental data pulled from ${res.saved.source}. Review and confirm below.`);
      }
      await reloadApp();
    } catch (e) {
      setError(e.friendlyMessage || 'Autofill failed. Check district is recognised.');
    } finally { setBusy(false); }
  };

  const runConfirm = async () => {
    setBusy(true); setError(null);
    try {
      await confirmEnvironment(selectedId);
      setEditedSinceLastScore(true);
      setInfo('Environmental data confirmed. You can now run/re-run scoring.');
      await reloadApp();
    } catch (e) {
      setError(e.friendlyMessage || 'Confirm failed.');
    } finally { setBusy(false); }
  };

  const runEdit = async (patch) => {
    setBusy(true); setError(null);
    try {
      await editEnvironment(selectedId, patch);
      setEditedSinceLastScore(true);
      setInfo('Environmental values updated. You can now run/re-run scoring.');
      await reloadApp();
    } catch (e) {
      setError(e.friendlyMessage || 'Edit failed.');
    } finally { setBusy(false); }
  };

  const runScore = async ({ force = false, rescore = false } = {}) => {
    if (scoring) return;
    if (rescore && readiness?.state === 'scored' && !editedSinceLastScore) {
      setInfo('Edit and save assessment data first, then click Re-score.');
      return;
    }
    setScoring(true);
    setError(null);
    setScoreResult(null);
    try {
      const res = await scoreApplication(selectedId, { force, rescore });
      setScoreResult(res);
      setEditedSinceLastScore(false);
      if (res.reused) {
        setInfo(
          `Returning the existing score from ${res.reusedAgeSec}s ago. Use Re-score after edits for a fresh run.`
        );
      } else {
        setInfo('Score saved successfully.');
      }
      await reloadApp();
    } catch (e) {
      if (e.response?.status === 422 && e.response?.data?.error?.code === 'READINESS_GATE') {
        setReadiness(e.response.data.error.readiness);
        setError('Scoring blocked — complete the sections listed in readiness, then try again.');
        setStep(2);
      } else {
        setError(
          e.friendlyMessage
            || e.message
            || (typeof e.response?.data?.message === 'string' ? e.response.data.message : null)
            || 'Scoring failed. Check the connection and try again, or open Reports if the service is down.'
        );
      }
    } finally {
      setScoring(false);
    }
  };

  const currentFarmActivity = farmer?.farmActivities?.[0] || null;
  const currentSocial = farmer?.socialCapital?.[0] || null;
  const currentHousehold = farmer?.householdIncome || null;
  const currentSatellite = application?.satelliteData?.[0] || null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Score a Loan Application</h1>
          <p className="page-subtitle">
            Loan-officer workflow with readiness checks and data-confidence controls before scoring.
          </p>
        </div>
        {application && (
          <div className="badge badge-info">
            {application.farmer?.fullName} · {application.farmer?.district} · {currency(application.amountRequested)}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="stepper">
          {STEPS.map((s) => {
            const active = s.id === step;
            const done = s.id < step;
            return (
              <div
                key={s.id}
                className={`step ${active ? 'is-active' : done ? 'is-done' : ''}`}
                onClick={() => setStep(s.id)}
              >
                <span className="step-num">{s.id}</span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {info && <div className="alert alert-info mb-4">{info}</div>}

      {step === 1 && (
        <StepSelect
          apps={apps}
          readinessByApp={appsReadiness}
          selectedId={selectedId}
          filter={appFilter}
          setFilter={setAppFilter}
          onSelect={chooseApp}
        />
      )}

      {selectedId && step === 2 && !application && (
        <div className="card">
          <div className="state">
            <div className="spinner" />
            <div className="text-sm text-muted mt-2">Loading application details...</div>
          </div>
        </div>
      )}

      {selectedId && application && step === 2 && (
        <StepFarmHousehold
          application={application}
          currentFarmActivity={currentFarmActivity}
          currentHousehold={currentHousehold}
          busy={busy}
          onSaveActivity={saveActivity}
          onSaveHousehold={saveHousehold}
          goNext={() => setStep(3)}
        />
      )}

      {selectedId && application && step === 3 && (
        <StepSocial
          farmer={farmer}
          currentSocial={currentSocial}
          busy={busy}
          onSave={saveSocial}
          goNext={() => setStep(4)}
          goBack={() => setStep(2)}
        />
      )}

      {selectedId && application && step === 4 && (
        <StepEnvironment
          application={application}
          currentSatellite={currentSatellite}
          busy={busy}
          onAutofill={runAutofill}
          onConfirm={runConfirm}
          onEdit={runEdit}
          goNext={() => setStep(5)}
          goBack={() => setStep(3)}
        />
      )}

      {selectedId && application && step === 5 && (
        <StepReview
          application={application}
          farmer={farmer}
          household={currentHousehold}
          activity={currentFarmActivity}
          social={currentSocial}
          satellite={currentSatellite}
          readiness={readiness}
          scoring={scoring}
          scoreResult={scoreResult}
          onScore={() => runScore({ force: false, rescore: false })}
          onRescore={() => runScore({ force: false, rescore: true })}
          onForceScore={() => runScore({ force: true, rescore: false })}
          onJumpToSection={(s) => setStep(s)}
          goBack={() => setStep(4)}
          onEditBeforeRescore={() => {
            setEditedSinceLastScore(true);
            setStep(2);
            setInfo('Update and save any section, then return to Re-score.');
          }}
          rescoreAllowed={editedSinceLastScore}
          navigate={navigate}
          xaiOverview={xaiOverview}
          xaiFeatureImportance={xaiFeatureImportance}
          xaiSampleExplanations={xaiSampleExplanations}
        />
      )}
    </div>
  );
}

function StepSelect({ apps, readinessByApp, selectedId, filter, setFilter, onSelect }) {
  const filteredApps = apps.filter((a) => {
    const r = readinessByApp[a.id];
    if (filter === 'all') return true;
    if (filter === 'ready') return r?.state === 'ready_to_score' || r?.state === 'ready_with_warnings';
    if (filter === 'needs') return r?.state === 'incomplete' || r?.state === 'needs_review';
    if (filter === 'scored') return r?.state === 'scored' || a.status === 'SCORED';
    return true;
  });
  const filterCount = (key) =>
    apps.filter((a) => {
      const r = readinessByApp[a.id];
      if (key === 'all') return true;
      if (key === 'ready') return r?.state === 'ready_to_score' || r?.state === 'ready_with_warnings';
      if (key === 'needs') return r?.state === 'incomplete' || r?.state === 'needs_review';
      if (key === 'scored') return r?.state === 'scored' || a.status === 'SCORED';
      return false;
    }).length;

  return (
    <div className="card">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>1 · Select a loan application</h2>
      </div>
      <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
        {[
          ['all', 'All'],
          ['ready', 'Ready to score'],
          ['needs', 'Needs more data'],
          ['scored', 'Scored'],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`btn btn-sm ${filter === k ? '' : 'btn-secondary'}`}
            onClick={() => setFilter(k)}
            type="button"
          >
            {label} ({filterCount(k)})
          </button>
        ))}
      </div>
      <div className="field field-full">
        <label className="field-label">Application</label>
        <select className="select" value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          <option value="">Choose an application…</option>
          {filteredApps.map((a) => {
            const r = readinessByApp[a.id];
            const rs = r?.state ? ` · ${r.state.replace(/_/g, ' ')}` : '';
            const warn = r?.warnings?.length ? ' · warnings' : '';
            return (
            <option key={a.id} value={a.id}>
              {a.farmer?.fullName || 'Unknown'} — {a.purpose} — {currency(a.amountRequested)} — {a.status}{rs}{warn}
            </option>
            );
          })}
        </select>
        <div className="field-hint">
          Visibility is controlled by the filter above. Applications are not hidden silently.
        </div>
      </div>
      {!filteredApps.length && (
        <div className="alert alert-info">
          No applications in this filter. Switch to <strong>All</strong> to see every record.
        </div>
      )}
    </div>
  );
}

function StepFarmHousehold({ application, currentFarmActivity, currentHousehold, busy, onSaveActivity, onSaveHousehold, goNext }) {
  const [editActivity, setEditActivity] = useState(false);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>2 · Farm activity</h2>
          <div className="flex gap-2 items-center">
            {currentFarmActivity && <ProvenanceBadge source="user" />}
            {currentFarmActivity && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditActivity((v) => !v)}>
                {editActivity ? 'Cancel edit' : 'Edit farm activity'}
              </button>
            )}
          </div>
        </div>
        {currentFarmActivity && !editActivity ? (
          <div className="kv-grid">
            <KV k="Main crop" v={currentFarmActivity.cropType} p="user" />
            <KV k="Estimated yield" v={currentFarmActivity.estimatedYield + ' t/ha'} p="user" />
            <KV k="Irrigation" v={currentFarmActivity.irrigation} p="user" />
            <KV k="Input usage" v={currentFarmActivity.inputUsage} p="user" />
            <KV k="Season" v={currentFarmActivity.season} p="user" />
            <KV k="Recorded" v={date(currentFarmActivity.createdAt)} />
          </div>
        ) : (
          <>
            {currentFarmActivity && (
              <div className="alert alert-info mb-3">
                Save to create an updated farm activity record that replaces missing/old values for scoring.
              </div>
            )}
            <FarmActivityForm
              farmerId={application.farmerId}
              createFn={async (payload) => {
                await onSaveActivity(payload);
                setEditActivity(false);
              }}
              submitting={busy}
            />
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>2 · Household income</h2>
          {currentHousehold?.mainAmount != null && <ProvenanceBadge source="user" />}
        </div>
        <HouseholdIncomeForm
          farmerId={application.farmerId}
          initial={currentHousehold || {}}
          upsertFn={onSaveHousehold}
          submitting={busy}
        />
      </div>

      <div className="step-footer">
        <div className="text-muted text-sm">Continue once farm activity and household income are saved.</div>
        <button className="btn" onClick={goNext}>Next · Social capital →</button>
      </div>
    </div>
  );
}

function StepSocial({ farmer, currentSocial, busy, onSave, goNext, goBack }) {
  const [editSocial, setEditSocial] = useState(false);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>3 · Social capital</h2>
          <div className="flex gap-2 items-center">
            {currentSocial && <ProvenanceBadge source="user" />}
            {currentSocial && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditSocial((v) => !v)}>
                {editSocial ? 'Cancel edit' : 'Edit social capital'}
              </button>
            )}
          </div>
        </div>
        {currentSocial && !editSocial ? (
          <div className="kv-grid">
            <KV k="Group member" v={currentSocial.groupMembership ? 'Yes' : 'No'} p="user" />
            <KV k="Group name" v={currentSocial.groupName} p="user" />
            <KV k="Years in group" v={currentSocial.yearsInGroup} p="user" />
            <KV k="Leadership role" v={currentSocial.leadershipRole} p="user" />
            <KV k="Guarantor available" v={currentSocial.guarantorAvailable ? 'Yes' : 'No'} p="user" />
          </div>
        ) : (
          <>
            {currentSocial && (
              <div className="alert alert-info mb-3">
                Save to create an updated social capital record that replaces missing/old values for scoring.
              </div>
            )}
            <SocialCapitalForm
              farmerId={farmer?.id}
              createFn={async (payload) => {
                await onSave(payload);
                setEditSocial(false);
              }}
              submitting={busy}
            />
          </>
        )}
      </div>
      <div className="step-footer">
        <button className="btn btn-secondary" onClick={goBack}>← Back</button>
        <button className="btn" onClick={goNext}>Next · Environmental data →</button>
      </div>
    </div>
  );
}

function StepEnvironment({ application, currentSatellite, busy, onAutofill, onConfirm, onEdit, goNext, goBack }) {
  const [editOpen, setEditOpen] = useState(false);
  const [patch, setPatch] = useState({});

  useEffect(() => {
    setPatch({});
    setEditOpen(false);
  }, [currentSatellite?.id]);

  const unconfirmed =
    currentSatellite &&
    !currentSatellite.confirmedAt &&
    (currentSatellite.sourceKind === 'live' || currentSatellite.sourceKind === 'fallback');
  const confirmed = currentSatellite?.confirmedAt;
  const fallback = currentSatellite?.sourceKind === 'fallback';

  const submitEdit = (e) => {
    e.preventDefault();
    const cleaned = {};
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) return;
      cleaned[k] = k === 'environmentRisk' ? v : Number(v);
    });
    if (Object.keys(cleaned).length === 0) {
      setEditOpen(false);
      return;
    }
    onEdit(cleaned).then(() => setEditOpen(false));
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0 }}>4 · Environmental & agronomic data</h2>
            <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
              Rainfall is pulled live from NASA POWER based on {application?.farmer?.district || "the farmer's district"} coordinates.
              NDVI is estimated from the district's agro-ecological profile modulated by the rainfall anomaly.
            </p>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => onAutofill(false)} disabled={busy}>
              {currentSatellite ? '↻ Refresh autofill' : '⛅ Autofill from satellite data'}
            </button>
            {currentSatellite && (
              <button className="btn btn-secondary" onClick={() => setEditOpen((o) => !o)} disabled={busy}>
                ✎ {editOpen ? 'Cancel edit' : 'Edit values'}
              </button>
            )}
          </div>
        </div>

        {!currentSatellite && (
          <div className="alert alert-info">
            No environmental record yet. Click <strong>Autofill from satellite data</strong> to pull rainfall (NASA POWER) and derive NDVI for this farmer's district.
          </div>
        )}

        {fallback && unconfirmed && (
          <div className="alert alert-warning mb-4">
            Live weather service was unreachable, so values came from the district climatology fallback. Please review carefully before confirming.
          </div>
        )}

        {unconfirmed && !fallback && (
          <div className="alert alert-info mb-4">
            These values were auto-filled from a live service and are <strong>awaiting your confirmation</strong>. Review them, edit if needed, then confirm.
          </div>
        )}

        {confirmed && (
          <div className="banner is-ok mb-4">
            ✓ Confirmed by officer on {date(currentSatellite.confirmedAt)}. These values now count as verified inputs.
          </div>
        )}

        {currentSatellite && <EnvironmentalMetrics data={currentSatellite} />}

        {currentSatellite && editOpen && (
          <form onSubmit={submitEdit} className="mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <div className="form-grid">
              <EditField label="Rainfall 30-day (mm)" field="rainfall30dMm" value={patch.rainfall30dMm ?? currentSatellite.rainfall30dMm} onChange={setPatch} />
              <EditField label="Rainfall 90-day (mm)" field="rainfall90dMm" value={patch.rainfall90dMm ?? currentSatellite.rainfall90dMm} onChange={setPatch} />
              <EditField label="NDVI mean (0–1)" field="ndvi90dMean" step="0.001" value={patch.ndvi90dMean ?? currentSatellite.ndvi90dMean} onChange={setPatch} />
              <EditField label="NDVI std" field="ndvi90dStd" step="0.001" value={patch.ndvi90dStd ?? currentSatellite.ndvi90dStd} onChange={setPatch} />
              <EditField label="Environmental score" field="environmentScore" value={patch.environmentScore ?? currentSatellite.environmentScore} onChange={setPatch} />
              <div className="field">
                <label className="field-label">Environmental risk</label>
                <select
                  className="select"
                  value={patch.environmentRisk ?? currentSatellite.environmentRisk ?? ''}
                  onChange={(e) => setPatch((p) => ({ ...p, environmentRisk: e.target.value || null }))}
                >
                  <option value="">—</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="btn" disabled={busy}>Save overrides</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditOpen(false); setPatch({}); }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={goBack}>← Back</button>
        <div className="flex gap-2">
          {unconfirmed && (
            <button className="btn" onClick={onConfirm} disabled={busy}>
              ✓ Confirm environmental values
            </button>
          )}
          <button className="btn btn-secondary" onClick={goNext} disabled={!currentSatellite}>
            Next · Review & score →
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, field, value, onChange, step }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="input"
        type="number"
        step={step || '0.1'}
        value={value ?? ''}
        onChange={(e) => onChange((p) => ({ ...p, [field]: e.target.value }))}
      />
    </div>
  );
}

function StepReview({
  application,
  farmer,
  household,
  activity,
  social,
  satellite,
  readiness,
  scoring,
  scoreResult,
  onScore,
  onRescore,
  onForceScore,
  onJumpToSection,
  goBack,
  onEditBeforeRescore,
  rescoreAllowed,
  navigate,
  xaiOverview,
  xaiFeatureImportance,
  xaiSampleExplanations,
}) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const envProv = (field) => {
    if (!satellite || satellite[field] == null) return 'missing';
    const per = satellite.provenance?.[field];
    if (per) return per;
    if (satellite.confirmedAt) return 'user_confirmed';
    if (satellite.sourceKind === 'fallback') return 'autofill_fallback';
    if (satellite.sourceKind === 'live') return 'autofill_live';
    if (satellite.sourceKind === 'edited') return 'edited';
    return 'autofill';
  };

  const sections = useMemo(() => [
    { title: 'Farmer', items: [
      ['Full name', farmer?.fullName, farmer?.fullName ? 'user' : 'missing'],
      ['Gender', farmer?.gender, farmer?.gender ? 'user' : 'missing'],
      ['Age', farmer?.age, farmer?.age != null ? 'user' : 'missing'],
      ['Education', farmer?.education, farmer?.education ? 'user' : 'missing'],
      ['Province', farmer?.province, farmer?.province ? 'user' : 'missing'],
      ['District', farmer?.district, farmer?.district ? 'user' : 'missing'],
      ['Ward', farmer?.ward, farmer?.ward ? 'user' : 'missing'],
      ['Farm size', farmer?.farmSizeHa ? `${farmer.farmSizeHa} ha` : null, farmer?.farmSizeHa != null ? 'user' : 'missing'],
      ['Household size', farmer?.householdSize, farmer?.householdSize != null ? 'user' : 'missing'],
    ] },
    { title: 'Loan request', items: [
      ['Amount requested', application?.amountRequested ? currency(application.amountRequested) : null, application?.amountRequested ? 'user' : 'missing'],
      ['Purpose', application?.purpose, application?.purpose ? 'user' : 'missing'],
      ['Season', application?.season, application?.season ? 'user' : 'missing'],
    ] },
    { title: 'Household income', items: [
      ['Main source', household?.mainSource, household?.mainSource ? 'user' : 'missing'],
      ['Main amount', household?.mainAmount, household?.mainAmount != null ? 'user' : 'missing'],
      ['Secondary source', household?.secondarySource, household?.secondarySource ? 'user' : 'missing'],
      ['Dietary diversity', household?.dietaryDiversity, household?.dietaryDiversity != null ? 'user' : 'missing'],
      ['Coping index', household?.copingIndex, household?.copingIndex != null ? 'user' : 'missing'],
      ['Shock experienced', household?.shockExperienced == null ? null : (household.shockExperienced ? 'Yes' : 'No'), household?.shockExperienced != null ? 'user' : 'missing'],
    ] },
    { title: 'Farm activity', items: [
      ['Main crop', activity?.cropType, activity?.cropType ? 'user' : 'missing'],
      ['Estimated yield', activity?.estimatedYield, activity?.estimatedYield != null ? 'user' : 'missing'],
      ['Irrigation', activity?.irrigation, activity?.irrigation ? 'user' : 'missing'],
      ['Input usage', activity?.inputUsage, activity?.inputUsage ? 'user' : 'missing'],
    ] },
    { title: 'Social capital', items: [
      ['Group member', social ? (social.groupMembership ? 'Yes' : 'No') : null, social ? 'user' : 'missing'],
      ['Group name', social?.groupName, social?.groupName ? 'user' : 'missing'],
      ['Guarantor available', social ? (social.guarantorAvailable ? 'Yes' : 'No') : null, social ? 'user' : 'missing'],
    ] },
    { title: 'Environmental data', items: [
      ['Rainfall 30d (mm)', satellite?.rainfall30dMm, envProv('rainfall30dMm')],
      ['Rainfall 90d (mm)', satellite?.rainfall90dMm, envProv('rainfall90dMm')],
      ['NDVI mean', satellite?.ndvi90dMean, envProv('ndvi90dMean')],
      ['NDVI variability', satellite?.ndvi90dStd, envProv('ndvi90dStd')],
      ['Environment score', satellite?.environmentScore, envProv('environmentScore')],
      ['Environment risk', satellite?.environmentRisk, envProv('environmentRisk')],
    ] },
  ], [application, farmer, household, activity, social, satellite]);

  const canScore = !!readiness?.canScore && readiness.state !== 'scored';
  const isScored = readiness?.state === 'scored';
  const blockedByReview = readiness?.state === 'needs_review';
  const incomplete = readiness?.state === 'incomplete';
  const prediction = scoreResult?.prediction || null;
  const scoreSavedAt = scoreResult?.score?.createdAt ? datetime(scoreResult.score.createdAt) : null;

  let scoreHint = 'All required sections are complete. You can run Fin-Agri Score.';
  if (!readiness) scoreHint = 'Checking whether this file is ready to score…';
  else if (incomplete) {
    scoreHint = 'We cannot run a reliable score until farm, household, social, and environment steps are complete. Use the checklist above.';
  } else if (blockedByReview) {
    scoreHint = 'Scoring is paused until you confirm the environmental / satellite data in step 4 (officer sign-off on auto-fill).';
  } else if (readiness?.state === 'ready_with_warnings') {
    scoreHint = 'You may run a score, but some inputs are weak or imputed — treat the result as advisory and read the warnings in the result card.';
  } else if (isScored) {
    scoreHint = 'A score is already on file. Edit and save a section, then re-score to refresh.';
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Readiness</h2>
          </div>
          <ReadinessChecklist readiness={readiness} onJumpToSection={onJumpToSection} />
        </div>

        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Assessment inputs used</h2>
            <span className="badge badge-neutral">{sections.reduce((a, s) => a + s.items.length, 0)} fields</span>
          </div>
          <div className="stack-sm">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="section-title" style={{ margin: '6px 0 4px' }}>{sec.title}</div>
                <div className="kv-grid">
                  {sec.items.map(([k, v, p]) => (
                    <div className="kv" key={k}>
                      <span className="k">{k}</span>
                      <span className="v">
                        {v == null || v === '' ? '—' : String(v)}
                        {p && <ProvenanceBadge source={p} compact />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Run Fin-Agri Score</h2>
            <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>{scoreHint}</p>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={goBack}>← Back to environment</button>
            {incomplete && (
              <button type="button" className="btn btn-warning" onClick={onForceScore} disabled={scoring || !readiness}>
                Override &amp; score anyway
              </button>
            )}
            {blockedByReview && (
              <button type="button" className="btn" onClick={() => onJumpToSection(4)}>
                Go to step 4 — confirm data
              </button>
            )}
            {isScored ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={onEditBeforeRescore}>
                  Edit data before re-score
                </button>
                <button
                  type="button"
                  className="btn btn-lg"
                  onClick={onRescore}
                  disabled={scoring || !rescoreAllowed}
                  title={!rescoreAllowed ? 'Edit and save any section before re-scoring' : 'Run a new score using updated data'}
                >
                  {scoring ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Scoring…</> : '↻ Re-score application'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-lg"
                onClick={onScore}
                disabled={!readiness || !canScore || scoring}
                title={!readiness || !canScore ? scoreHint : 'Run the Fin-Agri model on this file'}
              >
                {scoring ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Scoring…</> : 'Run Fin-Agri Score'}
              </button>
            )}
          </div>
        </div>
      </div>

      {scoring && (
        <div className="alert alert-info">
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }} />
          Running model scoring. Please wait...
        </div>
      )}

      {scoreResult && prediction && (
        <>
          <div className={`banner mb-3 ${scoreResult.reused ? 'is-warn' : 'is-ok'}`}>
            {scoreResult.reused
              ? `Existing score reused from ${scoreResult.reusedAgeSec || 0}s ago. Use Re-score after edits for a fresh run.`
              : `Score saved successfully${scoreSavedAt ? ` at ${scoreSavedAt}` : ''}.`}
          </div>

          <ScoreCard
            prediction={prediction}
            meta={{
              dataConfidence: scoreResult.dataConfidence,
              featureCoverage: scoreResult.featureCoverage,
              imputedFeatures: scoreResult.imputedFeatures,
              provenanceSummary: scoreResult.provenanceSummary,
              warnings: scoreResult.readiness?.warnings,
            }}
          />
          <div className="grid-2 layout-explain-split">
            <ExplanationPanel
              factors={prediction.top_factors || []}
              confidence={{
                dataConfidence: scoreResult.dataConfidence,
                featureCoverage: scoreResult.featureCoverage,
                imputedFeatures: scoreResult.imputedFeatures,
              }}
              readinessWarnings={scoreResult.readiness?.warnings || []}
              satellite={scoreResult.inputs?.satellite || satellite}
            />
            <EnvironmentalMetrics data={scoreResult.inputs?.satellite || satellite} />
          </div>
          <div className="mt-4">
            <ArtifactXaiPanel
              overview={xaiOverview}
              featureImportance={xaiFeatureImportance}
              sampleExplanations={xaiSampleExplanations}
            />
          </div>
          <div className="card">
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Next steps</h3>
                <p className="text-muted text-sm" style={{ marginBottom: 0 }}>
                  This result is saved in score history and audit logs. Continue to case review or reporting.
                </p>
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={() => navigate(`/applications/${application.id}`)}>
                  Open application
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pdfBusy}
                  onClick={async () => {
                    setPdfBusy(true);
                    try {
                      await downloadPdf(
                        applicationSummaryPdfPath(application.id),
                        `finagri-application-${application.id.slice(0, 8)}.pdf`
                      );
                    } finally {
                      setPdfBusy(false);
                    }
                  }}
                >
                  {pdfBusy ? 'Preparing PDF…' : 'Download case PDF'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/reports')}>
                  Reports
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/history')}>
                  Score history
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {scoreResult && !prediction && (
        <div className="alert alert-warning">
          Score response received, but explanation payload was incomplete. Open the application to verify saved score details.
          <div className="mt-2">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/applications/${application?.id}`)} disabled={!application?.id}>
              Open application
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ k, v, p }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">
        {v == null || v === '' ? '—' : String(v)}
        {p && <ProvenanceBadge source={p} compact />}
      </span>
    </div>
  );
}
