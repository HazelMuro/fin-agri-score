import { useState } from 'react';

const ROLES = ['None', 'Member', 'Committee', 'Chair', 'Treasurer', 'Secretary'];

export default function SocialCapitalForm({ farmerId, onSaved, submitting, createFn }) {
  const [form, setForm] = useState({
    groupMembership: 'No',
    groupName: '',
    yearsInGroup: '',
    leadershipRole: 'None',
    guarantorAvailable: 'No',
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isMember = form.groupMembership === 'Yes';

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const payload = {
        farmerId,
        groupMembership: isMember,
        groupName: isMember ? form.groupName || undefined : undefined,
        yearsInGroup: isMember && form.yearsInGroup ? Number(form.yearsInGroup) : undefined,
        leadershipRole: isMember ? form.leadershipRole : 'None',
        guarantorAvailable: form.guarantorAvailable === 'Yes',
      };
      const saved = await createFn(payload);
      onSaved?.(saved);
    } catch (e2) {
      setErr(e2.friendlyMessage || 'Failed to save');
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <div className="field">
          <label className="field-label">Farmer group membership *</label>
          <select className="select" value={form.groupMembership} onChange={set('groupMembership')} required>
            <option>No</option>
            <option>Yes</option>
          </select>
          <div className="field-hint">Co-operatives, irrigation schemes, savings clubs, etc.</div>
        </div>
        {isMember && (
          <>
            <div className="field">
              <label className="field-label">Group name</label>
              <input className="input" value={form.groupName} onChange={set('groupName')} placeholder="e.g. Murehwa Smallholder Coop" />
            </div>
            <div className="field">
              <label className="field-label">Years in group</label>
              <input className="input" type="number" min="0" max="60" value={form.yearsInGroup} onChange={set('yearsInGroup')} />
            </div>
            <div className="field">
              <label className="field-label">Leadership role</label>
              <select className="select" value={form.leadershipRole} onChange={set('leadershipRole')}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="field">
          <label className="field-label">Guarantor available? *</label>
          <select className="select" value={form.guarantorAvailable} onChange={set('guarantorAvailable')} required>
            <option>No</option>
            <option>Yes</option>
          </select>
          <div className="field-hint">A third party willing to guarantee the loan.</div>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      <div className="flex-between" style={{ marginTop: 8 }}>
        <div className="text-xs text-faint">* required</div>
        <button className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save social capital'}
        </button>
      </div>
    </form>
  );
}
