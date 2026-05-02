export const currency = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

export const number = (n, digits = 0) => {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
};

export const percent = (n, digits = 1) => {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
};

export const date = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const datetime = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

export const riskClass = (band) => {
  if (!band) return '';
  const b = String(band).toLowerCase();
  if (b.startsWith('low')) return 'badge-low';
  if (b.startsWith('med') || b.startsWith('mod')) return 'badge-medium';
  if (b.startsWith('high') || b.startsWith('very')) return 'badge-high';
  return '';
};
