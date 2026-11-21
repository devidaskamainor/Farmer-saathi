import { useState, useEffect } from 'react';
import { LoaderCircle, BadgeIndianRupee } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import Field from '../components/common/Field.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import MetaLine from '../components/common/MetaLine.jsx';
import MandiTrendCharts, { formatRupees } from '../components/dashboard/MandiTrendCharts.jsx';

export default function MarketsPage() {
  const { farmer } = useFarm();
  const [filters, setFilters] = useState({ commodity: '', market: '', state: farmer?.state || '', district: farmer?.district || '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/mandi/compare', { params: filters });
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); }, []);

  return <>
    <PageTitle eyebrow="MARKET INTELLIGENCE" title="Know the mandi price" description="Browse reported prices from the official market data source. Each record carries its market date." />
    <Card className="content-card">
      <form onSubmit={search} className="filter-form">
        <Field label="Crop or commodity" placeholder="e.g. Tomato" value={filters.commodity} onChange={commodity => setFilters({ ...filters, commodity })} />
        <Field label="Market" placeholder="Optional market name" value={filters.market} onChange={market => setFilters({ ...filters, market })} />
        <Field label="State" placeholder="e.g. Karnataka" value={filters.state} onChange={state => setFilters({ ...filters, state })} />
        <Field label="District" placeholder="e.g. Mysuru" value={filters.district} onChange={district => setFilters({ ...filters, district })} />
        <button className="primary-button search-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : null}Search prices</button>
      </form>
      {loading && <LoadingBox label="Fetching reported market records…" />}
      {error && !loading && <ErrorNotice retry={search}>{error}</ErrorNotice>}
      {!loading && !error && result && <>
        <div className="results-heading"><div><span className="eyebrow">{result.total} RECORDS</span><h2>Available mandi prices</h2></div><span className="rupee-note">Unit shown only when reported</span></div>
        {result.records.length ? <div className="table-wrap"><table><thead><tr><th>Commodity</th><th>Mandi</th><th>Market date</th><th>Min</th><th>Max</th><th>Modal</th><th>Unit</th></tr></thead><tbody>{result.records.map((row, i) => <tr key={`${row.market}-${row.commodity}-${row.marketDate}-${i}`}><td><b>{row.commodity || '—'}</b></td><td>{row.market || '—'}<small>{row.district}{row.state ? `, ${row.state}` : ''}</small></td><td>{row.marketDate || 'Not reported'}</td><td>{formatRupees(row.minPrice)}</td><td>{formatRupees(row.maxPrice)}</td><td className="modal-price">{formatRupees(row.modalPrice)}</td><td>{row.priceUnit || 'Not reported'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><BadgeIndianRupee size={28} /><h3>No records found</h3><p>Try a wider location or a different crop. No price is estimated when records are missing.</p></div>}
        <MandiTrendCharts trends={result.trends || []} source={result.source} />
        <MetaLine source={result.source} time={result.fetchedAt} />
      </>}
    </Card>
  </>;
}
