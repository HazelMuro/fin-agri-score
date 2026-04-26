/**
 * Horizontal scroll for wide tables + optional sticky first column (farmer / primary key).
 */
export default function TableScroll({
  children,
  stickyFirstColumn = true,
  ariaLabel = 'Data table',
}) {
  return (
    <div
      className={`table-scroll${stickyFirstColumn ? ' table-sticky-first' : ''}`}
      role="region"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
