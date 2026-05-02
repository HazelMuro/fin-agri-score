import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { downloadPdf, downloadReport, farmerSummaryPath, farmerSummaryPdfPath } from '../services/reports';
import ApplicationsTable from '../components/ApplicationsTable';
import FarmActivityForm from '../components/FarmActivityForm';
import SocialCapitalForm from '../components/SocialCapitalForm';
import HouseholdIncomeForm from '../components/HouseholdIncomeForm';
import { useApi } from '../hooks/useApi';
import { getFarmer } from '../services/farmers';
import { createFarmActivity, createSocialCapital, upsertHouseholdIncome } from '../services/assessment';
import { date, initials } from '../utils/format';

export default function FarmerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: farmer, loading, error, run } = useApi(() => getFarmer(id), { deps: [id] });
  const [adding, setAdding] = useState(null);
  const [exportPdfBusy, setExportPdfBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  const profileChecks = useMemo(() => [
    { key: 'household', done: !!farmer?.householdIncome, label: 'Household & income', action: 'income' },
    { key: 'activity', done: (farmer?.farmActivities?.length || 0) > 0, label: 'Farm activity', action: 'activity' },
    { key: 'social', done: (farmer?.socialCapital?.length || 0) > 0, label: 'Social capital', action: 'social' },
  ], [farmer]);

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (error) return <div className="page"><div className="card" style={{ color: 'var(--color-risk-high)' }}>{error}</div></div>;
  if (!farmer) return null;

  const save = async (fn, payload) => {
    await fn(payload);
    setAdding(null);
    run?.();
  };

  const profileDoneCount = profileChecks.filter((c) => c.done).length;
  const profilePct = Math.round((profileDoneCount / profileChecks.length) * 100);
  const applicationsCount = farmer.applications?.length || 0;
  
  const nextAction = (() => {
    if (profilePct < 100) {
      const missing = profileChecks.find(c => !c.done);
      return {
        label: `Complete ${missing.label}`,
        sub: 'A complete profile is required for a high-confidence credit score.',
        action: () => setAdding(missing.action),
        primary: true
      };
    }
    if (applicationsCount === 0) {
      return {
        label: 'Create Loan Application',
        sub: 'All profile data is ready. Start a new loan request for this farmer.',
        link: `/applications/new?farmerId=${farmer.id}`,
        primary: true
      };
    }
    const unscored = farmer.applications.some(a => a.status === 'PENDING');
    if (unscored) {
      return {
        label: 'Review & Score Application',
        sub: 'Pending applications are ready for assessment and model scoring.',
        link: `/score?farmerId=${farmer.id}`,
        primary: true
      };
    }
    return {
      label: 'New Loan Application',
      sub: 'Create another loan request for the upcoming season.',
      link: `/applications/new?farmerId=${farmer.id}`,
      primary: false
    };
  })();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/farmers" className="text-sm text-muted">← Back to farmers</Link>
          <div className="flex items-center gap-3" style={{ marginTop: 6 }}>
             <div className="initials-avatar">{initials(farmer.fullName)}</div>
             <div>
                <h1 className="page-title" style={{ margin: 0 }}>{farmer.fullName}</h1>
                <p className="page-subtitle">
                  {farmer.district || 'District unknown'}{farmer.province ? `, ${farmer.province}` : ''} · Registered {date(farmer.createdAt)}
                </p>
             </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exportPdfBusy}
            onClick={async () => {
              setExportError(null);
              setExportPdfBusy(true);
              try {
                await downloadPdf(
                  farmerSummaryPdfPath(farmer.id),
                  `finagri-farmer-${farmer.id.slice(0, 8)}.pdf`
                );
              } catch (e) {
                setExportError(e.friendlyMessage || 'PDF export failed.');
              } finally {
                setExportPdfBusy(false);
              }
            }}
          >
            {exportPdfBusy ? 'PDF…' : 'Export Profile PDF'}
          </button>
        </div>
      </div>

      {exportError && <div className="alert alert-danger mb-4">{exportError}</div>}

      <div className="grid-3-2 mb-6">
        <div className="stack">
          <div className={`card ${nextAction.primary ? 'card-primary-gradient' : ''}`}>
            <h3 style={{ marginTop: 0, color: nextAction.primary ? '#fff' : 'inherit' }}>Next recommended action</h3>
            <p style={{ color: nextAction.primary ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)' }}>{nextAction.sub}</p>
            <div className="mt-4">
              {nextAction.link ? (
                <Link className={`btn ${nextAction.primary ? 'btn-white' : ''}`} to={nextAction.link}>
                  {nextAction.label} →
                </Link>
              ) : (
                <button className={`btn ${nextAction.primary ? 'btn-white' : ''}`} onClick={nextAction.action}>
                  {nextAction.label} →
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Profile & Demographics</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/farmers/new?farmerId=${farmer.id}`)}>Edit</button>
            </div>
            <div className="kv-grid-compact mt-2">
               <KV k="Gender" v={farmer.gender} />
               <KV k="Age" v={farmer.age} />
               <KV k="Education" v={farmer.education} />
               <KV k="Household size" v={farmer.householdSize} />
               <KV k="Marital status" v={farmer.maritalStatus} />
               <KV k="Phone" v={farmer.phone} />
               <KV k="District" v={farmer.district} />
               <KV k="Ward" v={farmer.ward} />
               <KV k="Farm size" v={farmer.farmSizeHa ? `${farmer.farmSizeHa} ha` : null} />
            </div>
          </div>
        </div>

        <div className="stack">
           <div className="card">
              <h3 style={{ marginTop: 0 }}>Completeness</h3>
              <div className="progress-circle-container mb-4">
                <div className="progress-circle" style={{ '--pct': profilePct }}>
                  <span>{profilePct}%</span>
                </div>
                <div className="text-sm text-muted">Profile Data</div>
              </div>
              <div className="stack-sm">
                {profileChecks.map((c) => (
                  <div key={c.key} className={`checklist-item ${c.done ? 'is-ok' : 'is-missing'}`}>
                    <span>{c.done ? '✓' : '•'}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => setAdding(c.action)}>
                      {c.done ? 'Edit' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
           </div>

           <div className="card">
              <h3 style={{ marginTop: 0 }}>Case Summary</h3>
              <div className="flex-between py-2 border-b">
                <span className="text-muted text-sm">Total Applications</span>
                <strong>{applicationsCount}</strong>
              </div>
              <div className="flex-between py-2 border-b">
                <span className="text-muted text-sm">Scored Applications</span>
                <strong>{farmer.applications?.filter(a => a.status === 'SCORED').length || 0}</strong>
              </div>
           </div>
        </div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Farm Activity</h3>
            {!adding && (
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding('activity')}>
                {farmer.farmActivities?.length ? 'Update' : '+ Add'}
              </button>
            )}
          </div>
          {adding === 'activity' ? (
            <div className="mt-3">
              <FarmActivityForm farmerId={farmer.id} createFn={(p) => save(createFarmActivity, p)} />
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
            </div>
          ) : farmer.farmActivities?.length ? (
            <div className="stack-sm mt-2">
              {farmer.farmActivities.slice(0, 3).map((a) => (
                <div key={a.id} className="item-row">
                  <div className="font-bold">{a.cropType} · {a.season}</div>
                  <div className="text-xs text-muted">{a.estimatedYield} t/ha · {a.inputUsage} inputs</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-warning text-sm">No farm activity recorded.</div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Social Capital</h3>
            {!adding && (
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding('social')}>
                {farmer.socialCapital?.length ? 'Update' : '+ Add'}
              </button>
            )}
          </div>
          {adding === 'social' ? (
            <div className="mt-3">
              <SocialCapitalForm farmerId={farmer.id} createFn={(p) => save(createSocialCapital, p)} />
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
            </div>
          ) : farmer.socialCapital?.length ? (
            <div className="stack-sm mt-2">
              {farmer.socialCapital.slice(0, 3).map((s) => (
                <div key={s.id} className="item-row">
                  <div className="font-bold">{s.groupMembership ? s.groupName : 'Individual'}</div>
                  <div className="text-xs text-muted">{s.yearsInGroup} yrs · {s.guarantorAvailable ? 'Guarantor ✓' : 'No guarantor'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-warning text-sm">No social capital data.</div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Household & Income</h3>
          {!adding && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding('income')}>
              {farmer.householdIncome ? 'Edit' : '+ Add'}
            </button>
          )}
        </div>
        {adding === 'income' ? (
          <div className="mt-3">
            <HouseholdIncomeForm farmerId={farmer.id} initial={farmer.householdIncome || {}} upsertFn={(p) => save(upsertHouseholdIncome, p)} />
            <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        ) : farmer.householdIncome ? (
          <div className="kv-grid">
            <KV k="Main Source" v={farmer.householdIncome.mainSource} />
            <KV k="Main Amount" v={farmer.householdIncome.mainAmount} />
            <KV k="Shock Experienced" v={farmer.householdIncome.shockExperienced ? 'Yes' : 'No'} />
            <KV k="Dietary Diversity" v={farmer.householdIncome.dietaryDiversity} />
          </div>
        ) : (
          <div className="alert alert-warning text-sm">No household data recorded.</div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>Loan Applications</h2>
          <Link to={`/applications/new?farmerId=${farmer.id}`} className="btn btn-secondary btn-sm">+ New application</Link>
        </div>
        {farmer.applications?.length ? (
          <ApplicationsTable applications={farmer.applications} showFarmer={false} />
        ) : (
          <div className="state mt-4">
             <div className="state-emoji">📄</div>
             <p>No applications found.</p>
             <Link className="btn btn-sm" to={`/applications/new?farmerId=${farmer.id}`}>Create First Application</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v || '—'}</span>
    </div>
  );
}
