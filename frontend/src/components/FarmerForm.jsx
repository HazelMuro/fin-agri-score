import { useEffect, useState } from 'react';
import api from '../services/api';

const ZW_PROVINCES = [
  'Bulawayo',
  'Harare',
  'Manicaland',
  'Mashonaland Central',
  'Mashonaland East',
  'Mashonaland West',
  'Masvingo',
  'Matabeleland North',
  'Matabeleland South',
  'Midlands',
];

const EDUCATION_LEVELS = ['None', 'Primary', 'Secondary', 'A-Level', 'Tertiary', 'University'];
const MARITAL_STATUS = ['Single', 'Married', 'Widowed', 'Divorced'];

const PRIMARY_CROPS = [
  'Maize',
  'Tobacco',
  'Cotton',
  'Groundnuts',
  'Sugar beans',
  'Sorghum',
  'Small grains',
  'Horticulture',
  'Mixed cropping',
  'Livestock feed crops',
  'Other',
];

function buildWardLine(baseWard, primaryCrop, gpsCoordinates, groupMember) {
  const parts = [];
  if (baseWard?.trim()) parts.push(baseWard.trim());
  if (primaryCrop) parts.push(`Primary crop: ${primaryCrop}`);
  if (gpsCoordinates?.trim()) parts.push(`GPS: ${gpsCoordinates.trim()}`);
  if (groupMember === 'Yes') parts.push('Farmer group member: Yes');
  if (groupMember === 'No') parts.push('Farmer group member: No');
  return parts.length ? parts.join(' · ') : undefined;
}

export default function FarmerForm({ onSubmit, submitting }) {
  const [form, setForm] = useState({
    fullName: '',
    gender: '',
    age: '',
    phone: '',
    nationalId: '',
    province: '',
    district: '',
    ward: '',
    farmSizeHa: '',
    education: '',
    householdSize: '',
    maritalStatus: '',
    gpsCoordinates: '',
    primaryCrop: '',
    groupMember: '',
    monthlyHouseholdIncome: '',
  });

  const [districts, setDistricts] = useState([]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (!form.province) { setDistricts([]); return; }
    api.get('/districts', { params: { province: form.province } })
      .then((res) => setDistricts(res.data?.items || []))
      .catch(() => setDistricts([]));
  }, [form.province]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const mergedWard = buildWardLine(form.ward, form.primaryCrop, form.gpsCoordinates, form.groupMember);
    const payload = {
      fullName: form.fullName,
      gender: form.gender,
      age: form.age,
      phone: form.phone,
      nationalId: form.nationalId,
      province: form.province,
      district: form.district,
      ward: mergedWard,
      farmSizeHa: form.farmSizeHa,
      education: form.education,
      householdSize: form.householdSize,
      maritalStatus: form.maritalStatus,
    };
    if (payload.age) payload.age = Number(payload.age);
    if (payload.farmSizeHa) payload.farmSizeHa = Number(payload.farmSizeHa);
    if (payload.householdSize) payload.householdSize = Number(payload.householdSize);
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '' || payload[k] == null) delete payload[k];
    });

    const monthlyHouseholdIncome =
      form.monthlyHouseholdIncome === '' ? undefined : Number(form.monthlyHouseholdIncome);

    onSubmit({
      ...payload,
      ...(monthlyHouseholdIncome != null && !Number.isNaN(monthlyHouseholdIncome)
        ? { monthlyHouseholdIncome }
        : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div>
        <div className="section-title">1 · Personal details</div>
        <div className="form-grid">
          <div className="field field-full">
            <label className="field-label">Full name *</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} required placeholder="e.g. Tendai Moyo" />
          </div>
          <div className="field">
            <label className="field-label">Gender *</label>
            <select className="select" value={form.gender} onChange={set('gender')} required>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Age *</label>
            <input className="input" type="number" min="18" max="100" value={form.age} onChange={set('age')} required />
          </div>
          <div className="field">
            <label className="field-label">Phone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+263 ..." />
          </div>
          <div className="field">
            <label className="field-label">National ID</label>
            <input className="input" value={form.nationalId} onChange={set('nationalId')} placeholder="optional" />
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">2 · Location</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Province *</label>
            <select className="select" value={form.province} onChange={set('province')} required>
              <option value="">Select…</option>
              {ZW_PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">District *</label>
            <select className="select" value={form.district} onChange={set('district')} required disabled={!form.province}>
              <option value="">{form.province ? 'Select a district…' : 'Pick a province first'}</option>
              {districts.map((d) => <option key={d.district}>{d.district}</option>)}
            </select>
            <div className="field-hint">
              District selection lets the system autofill environmental data automatically.
            </div>
          </div>
          <div className="field">
            <label className="field-label">Ward</label>
            <input className="input" value={form.ward} onChange={set('ward')} placeholder="optional" />
          </div>
          <div className="field">
            <label className="field-label">Farm size (ha) *</label>
            <input className="input" type="number" step="0.1" value={form.farmSizeHa} onChange={set('farmSizeHa')} placeholder="e.g. 2.5" required />
          </div>
          <div className="field">
            <label className="field-label">GPS Coordinates</label>
            <input className="input" value={form.gpsCoordinates} onChange={set('gpsCoordinates')} placeholder="-19.015, 29.158" />
          </div>
          <div className="field field-full">
            <label className="field-label">Primary crop</label>
            <select className="select" value={form.primaryCrop} onChange={set('primaryCrop')}>
              <option value="">Select…</option>
              {PRIMARY_CROPS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Farmer group membership</label>
            <select className="select" value={form.groupMember} onChange={set('groupMember')}>
              <option value="">Prefer not to say</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Monthly household income (USD)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={form.monthlyHouseholdIncome}
              onChange={set('monthlyHouseholdIncome')}
              placeholder="optional — saved to household income"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">3 · Household & education</div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Education *</label>
            <select className="select" value={form.education} onChange={set('education')} required>
              <option value="">Select…</option>
              {EDUCATION_LEVELS.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Household size</label>
            <input className="input" type="number" min="1" max="30" value={form.householdSize} onChange={set('householdSize')} placeholder="people in household" />
          </div>
          <div className="field">
            <label className="field-label">Marital status</label>
            <select className="select" value={form.maritalStatus} onChange={set('maritalStatus')}>
              <option value="">Select…</option>
              {MARITAL_STATUS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="field-hint" style={{ marginTop: 8 }}>
          After registering the farmer, you'll be prompted to fill in farm activity, social capital,
          and household income details before scoring any loan application.
        </div>
      </div>

      <div className="flex-between" style={{ marginTop: 8 }}>
        <div className="text-xs text-faint">* required fields</div>
        <button className="btn" type="submit" disabled={submitting || !form.fullName}>
          {submitting ? 'Saving…' : 'Register farmer'}
        </button>
      </div>
    </form>
  );
}
