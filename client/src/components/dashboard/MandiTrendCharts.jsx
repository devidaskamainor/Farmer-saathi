export function formatRupees(value) {
  return value == null ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;
}

export function MandiTrendCharts({ trends, source }) {
  return <section className="mandi-trends" aria-labelledby="mandi-trend-title">
    <div className="results-heading"><div><span className="eyebrow">HISTORICAL RECORDS</span><h2 id="mandi-trend-title">Comparable price trends</h2></div></div>
    {trends.length === 0
      ? <p className="small-muted">No chart shown: at least two dated records with the same commodity, market, variety, grade, and reported unit are required.</p>
      : <div className="mandi-trend-grid">{trends.map((trend, index) => {
        const values = trend.series.map(point => point.modalPrice);
        const minimum = Math.min(...values);
        const range = Math.max(...values) - minimum || 1;
        const first = trend.series[0];
        const latest = trend.series[trend.series.length - 1];
        const points = trend.series.map((point, pointIndex) => {
          const x = trend.series.length < 2 ? 140 : 8 + pointIndex * (264 / (trend.series.length - 1));
          const y = 52 - ((point.modalPrice - minimum) / range) * 44;
          return `${x},${y}`;
        }).join(' ');
        return <article className="mandi-trend-card" key={`${trend.market}-${trend.commodity}-${trend.priceUnit}-${index}`}>
          <div className="mandi-trend-title"><b>{trend.commodity} · {trend.market}</b><span>{trend.variety || 'Variety not reported'} · {trend.grade || 'Grade not reported'}</span></div>
          <svg className="mandi-trend-line" viewBox="0 0 280 60" role="img" aria-label={`${trend.commodity} modal price trend at ${trend.market}`}>
            <polyline points={points} fill="none" stroke="#648767" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mandi-trend-change"><span>{formatRupees(first.modalPrice)} ({first.date}) → {formatRupees(latest.modalPrice)} ({latest.date})</span><b>{trend.change >= 0 ? '+' : ''}{formatRupees(trend.change)}{trend.changePercent == null ? '' : ` (${trend.changePercent.toFixed(1)}%)`}</b></div>
          <small>{trend.priceUnit} · same-market records from {source}</small>
        </article>;
      })}</div>}
  </section>;
}

export default MandiTrendCharts;
