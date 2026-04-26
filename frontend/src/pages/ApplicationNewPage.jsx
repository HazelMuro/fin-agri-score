import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import ApplicationForm from '../components/ApplicationForm';
import { createApplication } from '../services/applications';

export default function ApplicationNewPage() {
  const [searchParams] = useSearchParams();
  const defaultFarmerId = searchParams.get('farmerId') || '';
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const handleCreate = async (payload) => {
    setToast(null);
    setSubmitting(true);
    try {
      const created = await createApplication(payload);
      navigate(`/applications/${created.id}`, {
        replace: true,
        state: { flash: 'Application created. Continue to assessment or scoring when ready.' },
      });
    } catch (err) {
      setToast({ kind: 'error', msg: err.friendlyMessage || 'Failed to create application.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/applications" className="text-sm text-muted">
            ← Back to applications
          </Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            New loan application
          </h1>
          <p className="page-subtitle">
            Link the request to a registered farmer. Scoring runs separately once the assessment is complete.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className="card card-tight mb-4"
          style={{
            borderColor: 'var(--color-risk-high)',
            background: 'var(--color-risk-high-bg)',
            color: 'var(--color-risk-high)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="card card-lg" style={{ maxWidth: 720 }}>
        <ApplicationForm
          onSubmit={handleCreate}
          submitting={submitting}
          defaultFarmerId={defaultFarmerId}
          cancelHref="/applications"
        />
      </div>
    </div>
  );
}
