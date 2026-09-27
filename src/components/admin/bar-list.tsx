export function BarList({
  title,
  eyebrow,
  rows,
  formatValue,
}: {
  title: string;
  eyebrow: string;
  rows: { label: string; value: number; secondary?: string }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="admin-card">
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      </div>
      <div className="bar-list">
        {rows.length ? rows.map((row) => (
          <div className="bar-row" key={row.label}>
            <div className="bar-copy"><span>{row.label}</span><strong>{formatValue(row.value)}</strong></div>
            <div className="bar-track"><span style={{ width: `${row.value <= 0 ? 0 : Math.max(2, (row.value / max) * 100)}%` }} /></div>
            {row.secondary ? <small>{row.secondary}</small> : null}
          </div>
        )) : <p className="empty-state">No completed bookings in this range.</p>}
      </div>
    </div>
  );
}
