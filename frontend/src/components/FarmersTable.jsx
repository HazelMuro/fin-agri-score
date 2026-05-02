import { useNavigate } from 'react-router-dom';
import { initials } from '../utils/format';
import TableScroll from './TableScroll';

export default function FarmersTable({ farmers }) {
  const navigate = useNavigate();

  if (!farmers.length) {
    return (
      <div className="state">
        <div className="state-emoji">👤</div>
        <p>No farmers found matching your criteria.</p>
      </div>
    );
  }

  return (
    <TableScroll ariaLabel="Farmers list" stickyFirstColumn>
      <table className="table">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Location</th>
            <th>Phone</th>
            <th>Gender/Age</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {farmers.map((f) => (
            <tr key={f.id} onClick={() => navigate(`/farmers/${f.id}`)} style={{ cursor: 'pointer' }}>
              <td className="sticky-col">
                <div className="flex items-center gap-3">
                  <div className="initials-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {initials(f.fullName)}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {f.fullName}
                  </div>
                </div>
              </td>
              <td className="text-sm">
                {f.district} · {f.province}
              </td>
              <td className="text-sm font-mono">{f.phone || '—'}</td>
              <td className="text-sm text-muted">
                {f.gender || '—'} · {f.age || '—'}
              </td>
              <td className="text-right">
                <button 
                  className="btn btn-ghost btn-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/farmers/${f.id}`);
                  }}
                >
                  View Profile →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
