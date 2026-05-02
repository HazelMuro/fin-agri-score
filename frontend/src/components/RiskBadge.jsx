import { riskClass } from '../utils/format';
import { displayRiskBand } from '../utils/userManualDisplay';

export default function RiskBadge({ band, finAgriScore, size = 'md' }) {
  if (!band) return <span className="badge">Not scored</span>;
  const cls = riskClass(band);
  const label = displayRiskBand(band, finAgriScore);
  const sizeStyle =
    size === 'lg'
      ? { fontSize: 13, padding: '6px 14px' }
      : size === 'sm'
      ? { fontSize: 11, padding: '2px 8px' }
      : {};
  return (
    <span className={`badge badge-dot ${cls}`} style={sizeStyle}>
      {label}
    </span>
  );
}
