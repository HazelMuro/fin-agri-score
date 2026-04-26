import { riskClass } from '../utils/format';

export default function RiskBadge({ band, size = 'md' }) {
  if (!band) return <span className="badge">Not scored</span>;
  const cls = riskClass(band);
  const sizeStyle =
    size === 'lg'
      ? { fontSize: 13, padding: '6px 14px' }
      : size === 'sm'
      ? { fontSize: 11, padding: '2px 8px' }
      : {};
  return (
    <span className={`badge badge-dot ${cls}`} style={sizeStyle}>
      {band} risk
    </span>
  );
}
