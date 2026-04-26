/**
 * Compact readiness checklist.
 *
 * Renders the readiness payload shape:
 *   { completeness, confidence, state, sections: { key: { label, completeness, confidence, missing, note } }, warnings }
 */

const STATE_COPY = {
  incomplete:           { label: 'Incomplete',            help: 'Required fields are missing.' },
  needs_review:         { label: 'Needs review',          help: 'Auto-filled environmental values must be confirmed before scoring.' },
  ready_with_warnings:  { label: 'Ready with warnings',   help: 'Scorable, but some inputs are low confidence.' },
  ready_to_score:       { label: 'Ready to score',        help: 'All sections complete, high confidence.' },
  scored:               { label: 'Already scored',        help: 'Open the latest score below, or re-score.' },
};

const SECTION_ORDER = ['farmer', 'loan', 'household', 'activity', 'social', 'environment'];
const STEP_MAP = { farmer: 1, loan: 1, household: 2, activity: 2, social: 3, environment: 4 };

export default function ReadinessChecklist({ readiness, onJumpToSection, showHeader = true }) {
  if (!readiness) return null;
  const stateCls = `state-pill is-${readiness.state}`;
  const stateCopy = STATE_COPY[readiness.state] || { label: readiness.state, help: '' };

  return (
    <div>
      {showHeader && (
        <div className="flex-between mb-3" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className={stateCls}>{stateCopy.label}</span>
            <div className="text-xs text-muted mt-2">{stateCopy.help}</div>
          </div>
          <DualProgress completeness={readiness.completeness} confidence={readiness.confidence} />
        </div>
      )}

      <div className="checklist">
        {SECTION_ORDER.map((key) => {
          const s = readiness.sections?.[key];
          if (!s) return null;
          const cls =
            s.completeness >= 100 ? 'is-ok' : s.completeness > 0 ? 'is-partial' : 'is-missing';
          const icon = s.completeness >= 100 ? '✓' : s.completeness > 0 ? '◐' : '✗';
          const click = onJumpToSection ? () => onJumpToSection(STEP_MAP[key]) : undefined;
          return (
            <div
              key={key}
              className={`checklist-item ${cls}`}
              onClick={click}
              style={{ cursor: click ? 'pointer' : 'default' }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.label}</div>
                {s.missing?.length > 0 && (
                  <div className="cl-meta">Missing: {s.missing.join(', ')}</div>
                )}
                {s.note && !s.missing?.length && (
                  <div className="cl-meta">{s.note}</div>
                )}
              </div>
              {click && s.completeness < 100 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginRight: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    click();
                  }}
                >
                  Edit section
                </button>
              )}
              <span className="checklist-status">
                {s.completeness}% · <span className="text-muted">{s.confidence}%</span>
              </span>
            </div>
          );
        })}
      </div>

      {readiness.warnings?.length > 0 && (
        <div className="alert alert-warning mt-4" role="status">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {readiness.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DualProgress({ completeness, confidence }) {
  const confCls =
    confidence >= 75
      ? ''
      : confidence >= 50
      ? 'progress-warning'
      : 'progress-danger';
  return (
    <div className="progress-dual" style={{ minWidth: 260 }}>
      <div className="pd-item">
        <div className="pd-row">
          <strong>Completeness</strong>
          <span className="pd-pct">{completeness}%</span>
        </div>
        <div className="progress progress-sm">
          <span style={{ width: `${completeness}%` }} />
        </div>
      </div>
      <div className="pd-item">
        <div className="pd-row">
          <strong>Confidence</strong>
          <span className="pd-pct">{confidence}%</span>
        </div>
        <div className={`progress progress-sm ${confCls}`}>
          <span style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  );
}
