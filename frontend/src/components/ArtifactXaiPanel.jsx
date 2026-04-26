export default function ArtifactXaiPanel({
  overview,
  featureImportance = [],
  sampleExplanations = [],
  title = 'Model training reference',
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
            Global feature ranking and example SHAP rows from the saved training run — context for policy and audit, not a second local prediction.
          </p>
        </div>
        <span className="badge badge-neutral">Training file</span>
      </div>

      <div className="grid-2">
        <div>
          <h4 style={{ margin: '0 0 8px' }}>Top global features</h4>
          {(featureImportance.length ? featureImportance : (overview?.featureImportanceTop || []))
            .slice(0, 10)
            .map((f, idx) => (
              <div key={`${f.feature}-${idx}`} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-navy)' }}>{f.feature}</span>
                <span className="text-xs font-mono">{Number(f.importance || 0).toFixed(4)}</span>
              </div>
            ))}
          {!featureImportance.length && !(overview?.featureImportanceTop || []).length && (
            <p className="text-sm text-muted">No artifact feature-importance data found.</p>
          )}
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px' }}>Saved sample explanations</h4>
          {sampleExplanations.slice(0, 2).map((s, idx) => (
            <details key={idx} className="disclosure mb-2">
              <summary>
                Row #{s.test_row_index} · true {s.true_label} · predicted {s.predicted_label}
              </summary>
              <div className="disclosure-body">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(s.top_contributions || []).slice(0, 5).map((c, i) => (
                    <li key={i} className="text-sm">
                      <strong>{c.feature}</strong> — {c.direction.replace('_', ' ')}
                      {' '}({Number(c.shap_value || 0).toFixed(4)})
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
          {!sampleExplanations.length && (
            <p className="text-sm text-muted">No saved sample SHAP explanations found.</p>
          )}
        </div>
      </div>

      {overview?.finalMetrics && (
        <div className="mt-4 text-xs text-muted">
          Model: <strong>{overview.selectedModel || 'unknown'}</strong> ·
          {' '}macro F1: <strong>{Number(overview.finalMetrics.f1_macro || 0).toFixed(4)}</strong> ·
          {' '}balanced accuracy: <strong>{Number(overview.finalMetrics.balanced_accuracy || 0).toFixed(4)}</strong>
        </div>
      )}
    </div>
  );
}

