import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
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
  const { data: farmer, loading, error, run } = useApi(() => getFarmer(id), { deps: [id] });
  const [adding, setAdding] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPdfBusy, setExportPdfBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (error) return <div className="page"><div className="card" style={{ color: 'var(--color-risk-high)' }}>{error}</div></div>;
  if (!farmer) return null;

  const save = async (fn, payload) => {
    await fn(payload);
    setAdding(null);
    run?.();
  };

  const profileChecks = [
    { key: 'household', done: !!farmer.householdIncome, label: 'Household & income', action: 'income' },
    { key: 'activity', done: (farmer.farmActivities?.length || 0) > 0, label: 'Farm activity', action: 'activity' },
    { key: 'social', done: (farmer.socialCapital?.length || 0) > 0, label: 'Social capital', action: 'social' },
  ];
  const profileDone = profileChecks.filter((c) => c.done).length;
  const profilePct = Math.round((profileDone / profileChecks.length) * 100);
  const applicationsCount = farmer.applications?.length || 0;
  const scoredCount = (farmer.applications || []).filter((a) => a.status === 'SCORED').length;
  const nextAction =
    profilePct < 100
      ? { label: 'Complete profile data', action: () => setAdding(profileChecks.find((c) => !c.done)?.action || 'income') }
      : applicationsCount === 0
      ? { link: `/applications/new?farmerId=${farmer.id}`, label: 'Create first application' }
      : { link: `/score?farmerId=${farmer.id}`, label: 'Review and score applications' };

  return (
    <div className="page">
      {exportError ? (
        <div className="alert alert-danger mb-4" role="alert">
          {exportError}
        </div>
      ) : null}
      <div className="page-header">
        <div>
          <Link to="/farmers" className="text-sm text-muted">← Back to farmers</Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>{farmer.fullName}</h1>
          <p className="page-subtitle">
            {farmer.district || 'District unknown'}{farmer.province ? `, ${farmer.province}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exportBusy}
            onClick={async () => {
              setExportError(null);
              setExportBusy(true);
              try {
                await downloadReport(
                  farmerSummaryPath(farmer.id),
                  `finagri-farmer-${farmer.id.slice(0, 8)}.csv`
                );
              } catch (e) {
                setExportError(e.friendlyMessage || 'Export failed.');
              } finally {
                setExportBusy(false);
              }
            }}
          >
            {exportBusy ? 'Exporting…' : 'Export profile CSV'}
          </button>
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
            {exportPdfBusy ? 'PDF…' : 'Export profile PDF'}
          </button>
          <Link to={`/applications/new?farmerId=${farmer.id}`} className="btn">+ Create application</Link>
          <Link to={`/score?farmerId=${farmer.id}`} className="btn btn-secondary">Review & score</Link>
        </div>
      </div>

      <ProfileCompletionBanner farmer={farmer} setAdding={setAdding} />

      <div className="grid-3 mb-6">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Case overview</h3>
          <InfoRow label="Profile completion" value={`${profilePct}%`} />
          <InfoRow label="Applications" value={applicationsCount} />
          <InfoRow label="Scored applications" value={scoredCount} />
          <InfoRow
            label="Last activity"
            value={
              farmer.applications?.[0]?.createdAt
                ? `Application ${date(farmer.applications[0].createdAt)}`
                : `Registered ${date(farmer.createdAt)}`
            }
          />
          <div className="mt-3">
            {nextAction.link ? (
              <Link className="btn btn-sm" to={nextAction.link}>
                {nextAction.label}
              </Link>
            ) : (
              <button className="btn btn-sm" onClick={nextAction.action}>
                {nextAction.label}
              </button>
            )}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Action checklist</h3>
          <div className="stack-sm">
            {profileChecks.map((c) => (
              <div key={c.key} className={`checklist-item ${c.done ? 'is-ok' : 'is-missing'}`}>
                <span>{c.done ? '✓' : '•'}</span>
                <span>{c.label}</span>
                <span className="checklist-status">{c.done ? 'Done' : 'Missing'}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted mt-3">
            Missing sections reduce confidence and can block clean scoring recommendations.
          </div>
        </div>
        <ProfileCard farmer={farmer} />
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Farm activities</h3>
            {!adding && <button className="btn btn-ghost btn-sm" onClick={() => setAdding('activity')}>{farmer.farmActivities?.length ? 'Update' : '+ Add'}</button>}
          </div>
          {adding === 'activity' ? (
            <>
              <FarmActivityForm
                farmerId={farmer.id}
                createFn={(p) => save(createFarmActivity, p)}
              />
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
            </>
          ) : farmer.farmActivities?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {farmer.farmActivities.slice(0, 5).map((a) => (
                <li key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {a.cropType} · {a.estimatedYield ? `${a.estimatedYield} t/ha` : '—'}
                  </div>
                  <div className="text-xs text-muted">
                    Season {a.season} · {a.inputUsage || '—'} inputs · irrigation: {a.irrigation || '—'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="alert alert-warning">
              No farm activity recorded yet. Add this section to improve readiness quality before scoring.
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Social capital</h3>
            {!adding && !farmer.socialCapital?.length && (
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding('social')}>+ Add</button>
            )}
          </div>
          {adding === 'social' ? (
            <>
              <SocialCapitalForm
                farmerId={farmer.id}
                createFn={(p) => save(createSocialCapital, p)}
              />
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
            </>
          ) : farmer.socialCapital?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {farmer.socialCapital.map((s) => (
                <li key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {s.groupMembership ? (s.groupName || 'Unnamed group') : 'Not a group member'}
                  </div>
                  <div className="text-xs text-muted">
                    {s.yearsInGroup ? `${s.yearsInGroup} yrs` : ''}
                    {s.leadershipRole && s.leadershipRole !== 'None' ? ` · ${s.leadershipRole}` : ''}
                    {' · '}
                    {s.guarantorAvailable ? 'guarantor ✓' : 'no guarantor'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="alert alert-warning">
              No social capital record yet. Add membership/guarantor details for better lending context.
            </div>
          )}
        </div>
      </div>

      {}
      <div className="card mb-6">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Household & income</h3>
          {!adding && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding('income')}>
              {farmer.householdIncome ? 'Edit' : '+ Add'}
            </button>
          )}
        </div>
        {adding === 'income' ? (
          <>
            <HouseholdIncomeForm
              farmerId={farmer.id}
              initial={farmer.householdIncome || {}}
              upsertFn={(p) => save(upsertHouseholdIncome, p)}
            />
            <button className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(null)}>Cancel</button>
          </>
        ) : farmer.householdIncome ? (
          <div className="kv-grid">
            <KV k="Main source" v={farmer.householdIncome.mainSource} />
            <KV k="Main amount (USD/mo)" v={farmer.householdIncome.mainAmount} />
            <KV k="Secondary source" v={farmer.householdIncome.secondarySource} />
            <KV k="Secondary amount (USD/mo)" v={farmer.householdIncome.secondaryAmount} />
            <KV k="Recent shock" v={farmer.householdIncome.shockExperienced ? 'Yes' : 'No'} />
            <KV k="Coping index" v={farmer.householdIncome.copingIndex} />
            <KV k="Dietary diversity" v={farmer.householdIncome.dietaryDiversity} />
          </div>
        ) : (
          <div className="alert alert-warning">
            No household or income record yet. Add this to avoid weak confidence during scoring.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>Loan applications</h2>
          <Link to={`/applications/new?farmerId=${farmer.id}`} className="btn btn-ghost btn-sm">+ New application</Link>
        </div>
        {farmer.applications?.length ? (
          <ApplicationsTable applications={farmer.applications || []} showFarmer={false} />
        ) : (
          <div className="state">
            <div className="state-emoji">🗂️</div>
            <p>No loan applications yet for this farmer.</p>
            <Link className="btn btn-sm" to={`/applications/new?farmerId=${farmer.id}`}>
              Create first application
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCompletionBanner({ farmer, setAdding }) {
  const checks = [
    { key: 'household', done: !!farmer.householdIncome, action: () => setAdding('income'), label: 'Household & income' },
    { key: 'activity', done: (farmer.farmActivities?.length || 0) > 0, action: () => setAdding('activity'), label: 'Farm activity' },
    { key: 'social', done: (farmer.socialCapital?.length || 0) > 0, action: () => setAdding('social'), label: 'Social capital' },
  ];
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter((c) => !c.done);
  return (
    <div className="card mb-6">
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Profile completion</h3>
          <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
            Complete profile data to improve scoring confidence and decision quality.
          </p>
        </div>
        <span className={`badge ${pct === 100 ? 'badge-low' : 'badge-medium'}`}>{pct}% complete</span>
      </div>
      <div className={`progress mt-3 ${pct < 50 ? 'progress-danger' : pct < 100 ? 'progress-warning' : ''}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {missing.length > 0 ? (
        <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
          {missing.map((m) => (
            <button key={m.key} className="btn btn-secondary btn-sm" onClick={m.action}>
              Complete {m.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="alert alert-success mt-3">
          Farmer profile is complete. You can proceed to create and score an application.
        </div>
      )}
    </div>
  );
}

function ProfileCard({ farmer }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800,
          }}
        >
          {initials(farmer.fullName)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-navy)' }}>{farmer.fullName}</div>
          <div className="text-sm text-muted">Registered {date(farmer.createdAt)}</div>
        </div>
      </div>
      <InfoRow label="Gender" value={farmer.gender} />
      <InfoRow label="Age" value={farmer.age} />
      <InfoRow label="Education" value={farmer.education} />
      <InfoRow label="Household size" value={farmer.householdSize} />
      <InfoRow label="Marital status" value={farmer.maritalStatus} />
      <InfoRow label="Phone" value={farmer.phone} />
      <InfoRow label="Province" value={farmer.province} />
      <InfoRow label="District" value={farmer.district} />
      <InfoRow label="Ward" value={farmer.ward} />
      <InfoRow label="Farm size" value={farmer.farmSizeHa != null ? `${farmer.farmSizeHa} ha` : null} />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-navy)' }}>{value || '—'}</span>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v == null || v === '' ? '—' : String(v)}</span>
    </div>
  );
}
