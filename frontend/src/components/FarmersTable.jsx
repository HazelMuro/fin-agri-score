import { Link } from 'react-router-dom';
import TableScroll from './TableScroll';
import { initials } from '../utils/format';

export default function FarmersTable({ farmers = [] }) {
  if (!farmers.length) {
    return (
      <div className="state">
        <div className="state-emoji">🌱</div>
        <p>No farmers yet. Register your first farmer to get started.</p>
      </div>
    );
  }

  return (
    <TableScroll ariaLabel="Farmers" stickyFirstColumn>
      <table className="table">
      <thead>
        <tr>
          <th>Farmer</th>
          <th>District</th>
          <th>Farm size</th>
          <th>Applications</th>
          <th className="text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {farmers.map((f) => (
          <tr key={f.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--color-primary-50)', color: 'var(--color-primary)',
                    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}
                >
                  {initials(f.fullName)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{f.fullName}</div>
                  <div className="text-xs text-faint">{f.phone || f.nationalId || '—'}</div>
                </div>
              </div>
            </td>
            <td>
              <div>{f.district || '—'}</div>
              <div className="text-xs text-faint">{f.province || ''}</div>
            </td>
            <td>{f.farmSizeHa != null ? `${f.farmSizeHa} ha` : '—'}</td>
            <td>{f._count?.applications ?? 0}</td>
            <td className="text-right">
              <Link className="btn btn-ghost btn-sm" to={`/farmers/${f.id}`}>
                View profile
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </TableScroll>
  );
}
