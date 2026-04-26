/**
 * Small inline pill that describes where a value came from.
 *
 * Provenance tags (must match backend featureBuilder + environmentService):
 *   user             - captured by the officer
 *   user_confirmed   - auto-filled then explicitly confirmed by the officer
 *   edited           - officer typed a value that overrode autofill
 *   autofill_live    - pulled from a live service (NASA POWER)
 *   autofill_fallback- pulled from the seeded district climatology fallback
 *   autofill         - legacy / generic autofill
 *   derived          - computed from other user-entered fields
 *   derived_from_rainfall - NDVI derived from rainfall anomaly
 *   default          - fallback constant, not real data
 *   missing          - no value; the model will have to impute
 */

const MAP = {
  user:                  { cls: 'prov-user',      label: 'User entered' },
  user_confirmed:        { cls: 'prov-confirmed', label: 'Confirmed' },
  edited:                { cls: 'prov-confirmed', label: 'Edited by user' },
  autofill_live:         { cls: 'prov-autolive',  label: 'Auto-filled · live' },
  autofill_fallback:     { cls: 'prov-autofall',  label: 'Auto-filled · fallback' },
  autofill:              { cls: 'prov-autolive',  label: 'Auto-filled' },
  derived:               { cls: 'prov-derived',   label: 'Derived' },
  derived_from_rainfall: { cls: 'prov-derived',   label: 'Derived · rainfall' },
  default:               { cls: 'prov-default',   label: 'Default' },
  missing:               { cls: 'prov-missing',   label: 'Missing' },
};

export default function ProvenanceBadge({ source, compact = false, title }) {
  if (!source) return null;
  const entry = MAP[source] || { cls: 'prov-derived', label: source };
  const text = compact ? entry.label.split(' ')[0] : entry.label;
  return (
    <span className={`prov ${entry.cls}`} title={title || entry.label}>
      {text}
    </span>
  );
}

export function provenanceLabel(source) {
  return (MAP[source] && MAP[source].label) || source;
}

export function provenanceClass(source) {
  return (MAP[source] && MAP[source].cls) || 'prov-derived';
}
