type Point = { label: string; revenueCents: number; netProfitCents: number };

function linePath(values: number[], width: number, height: number, max: number, min: number) {
  if (!values.length) return "";
  const span = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function TrendChart({ data, currency }: { data: Point[]; currency: string }) {
  const width = 900;
  const height = 260;
  const pad = 18;
  const values = data.flatMap((d) => [d.revenueCents, d.netProfitCents]);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const revenue = linePath(data.map((d) => d.revenueCents), width - pad * 2, height - pad * 2, max, min);
  const profit = linePath(data.map((d) => d.netProfitCents), width - pad * 2, height - pad * 2, max, min);
  const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const ticks = [max, min + (max - min) * 0.5, min];
  const labels = data.length ? [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]] : [];

  return (
    <div className="admin-card chart-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trend</p>
          <h2>Revenue and estimated net profit</h2>
        </div>
        <div className="chart-legend" aria-label="Chart legend">
          <span><i className="legend-dot revenue-dot" /> Revenue</span>
          <span><i className="legend-dot profit-dot" /> Net profit</span>
        </div>
      </div>
      {data.length ? (
        <svg className="trend-svg" viewBox={`0 0 ${width} ${height + 34}`} role="img" aria-label="Revenue and net profit trend">
          <g transform={`translate(${pad} ${pad})`}>
            {[0, 0.5, 1].map((ratio) => <line key={ratio} x1="0" x2={width - pad * 2} y1={(height - pad * 2) * ratio} y2={(height - pad * 2) * ratio} className="chart-grid" />)}
            <path d={revenue} className="chart-line chart-line-revenue" />
            <path d={profit} className="chart-line chart-line-profit" />
          </g>
          {ticks.map((tick, i) => <text key={i} x="4" y={20 + i * ((height - 36) / 2)} className="chart-y-label">{formatter.format(tick / 100)}</text>)}
          {labels.map((item, i) => <text key={`${item.label}-${i}`} x={pad + i * ((width - pad * 2) / 2)} y={height + 24} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="chart-x-label">{item.label}</text>)}
        </svg>
      ) : <p className="empty-state">No data in this range yet.</p>}
    </div>
  );
}
