import { useState, useEffect, useRef } from 'react';
import { Landmark, ShieldCheck, LoaderCircle, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import { supportedLanguages, localizedCopy } from '../services/languageStorage.js';
import { schemesCopy, schemeDetailLabels, schemeExtraLabels } from '../config/translations.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';

export default function SchemesPage() {
  const { farmer } = useFarm();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(schemesCopy, language);
  const detailLabels = localizedCopy(schemeDetailLabels, language);
  const extraLabels = localizedCopy(schemeExtraLabels, language);
  const [query, setQuery] = useState('');
  const [state, setState] = useState(farmer?.state || '');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(0);

  async function load() {
    setLoading(true); setError('');
    try {
      const params = { state: state || '', category };
      const { data } = query.trim()
        ? await api.get('/schemes/search', { params: { ...params, q: query.trim() } })
        : await api.get('/schemes', { params });
      setResult(data);
    } catch (e) { setResult(null); setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function categoryLabel(value) {
    return value === 'income-support' ? copy.income : value === 'crop-insurance' ? copy.insurance : value === 'water-management' ? copy.water : value;
  }

  async function loadDetails(id, contentLanguage) {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const { data } = await api.get(`/schemes/${encodeURIComponent(id)}`, { params: { language: contentLanguage } });
      if (requestId === detailRequestRef.current) setSelected(data.scheme);
    } catch (e) {
      if (requestId === detailRequestRef.current) setDetailError(errorMessage(e));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  function showDetails(scheme) {
    setSelected(scheme);
    loadDetails(scheme.id, language);
  }

  function closeDetails() {
    detailRequestRef.current += 1;
    setSelected(null);
    setDetailLoading(false);
    setDetailError('');
  }

  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={result?.dataType === 'verified-catalogue' ? <span className="scheme-data-badge"><ShieldCheck size={14} />{extraLabels.catalogue} · {result.verificationDate}</span> : null} />
    <Card className="scheme-catalogue-card">
      <form className="scheme-filter-form" onSubmit={event => { event.preventDefault(); load(); }}>
        <label className="field scheme-search-field"><span>{copy.search}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={language === 'kn' ? 'ಯೋಜನೆಯ ಹೆಸರು ಅಥವಾ ವಿಭಾಗ' : language === 'hi' ? 'योजना का नाम या श्रेणी' : 'Scheme name or keyword'} /></label>
        <label className="field"><span>{copy.state}</span><select value={state} onChange={event => setState(event.target.value)}><option value="">{copy.allStates}</option><option value="Karnataka">{extraLabels.karnataka}</option><option value="All India">{extraLabels.allIndia}</option></select></label>
        <label className="field"><span>{copy.category}</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">{copy.allCategories}</option><option value="income-support">{copy.income}</option><option value="crop-insurance">{copy.insurance}</option><option value="water-management">{copy.water}</option></select></label>
        <button className="primary-button scheme-search-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null}{copy.search}</button>
      </form>
      {loading ? <LoadingBox label={copy.loading} /> : error ? <ErrorNotice retry={load}>{error}</ErrorNotice> : <>
        {result?.schemes?.length ? <div className="scheme-grid">{result.schemes.map(scheme => <article className="scheme-card" key={scheme.id}>
          <div className="scheme-card-head"><span className="scheme-level"><Landmark size={14} />{scheme.level === 'Central' ? copy.central : copy.stateScheme}</span><span className="scheme-category">{categoryLabel(scheme.category)}</span></div>
          {scheme.potentiallyRelevant && <span className="scheme-relevance-badge">{copy.relevant} · {detailLabels.notEligibility}</span>}
          {scheme.translation?.status === 'translated' && <span className="scheme-translation-badge">{detailLabels.translatedNotice}</span>}
          <h2>{scheme.name}</h2><p>{scheme.description}</p>
          <div className="scheme-audience"><b>{scheme.intendedFor}</b><span>{scheme.states.map(value => value === 'All India' ? extraLabels.allIndia : value === 'Karnataka' ? extraLabels.karnataka : value).join(', ')}</span></div>
          <div className="scheme-card-actions"><button type="button" className="primary-button" onClick={() => showDetails(scheme)}>{copy.details}<ArrowRight size={15} /></button><a className="subtle-button" href={scheme.informationUrl} target="_blank" rel="noreferrer">{copy.official}<ArrowRight size={15} /></a></div>
        </article>)}</div> : <div className="empty-state scheme-empty"><Landmark size={28} /><h3>{copy.noResults}</h3><p>Check the official myScheme portal for current records.</p><a className="primary-button" href={result?.mySchemeUrl || 'https://www.myscheme.gov.in/'} target="_blank" rel="noreferrer">{copy.myScheme}<ArrowRight size={16} /></a></div>}
      </>}
    </Card>
    {selected && <div className="scheme-detail-overlay" role="dialog" aria-modal="true" aria-label={selected.name} onMouseDown={event => { if (event.target === event.currentTarget) closeDetails(); }}><Card className="scheme-detail-card">
      <div className="scheme-detail-head"><div><span className="eyebrow">{categoryLabel(selected.category)} · {selected.level}</span><h2>{selected.name}</h2></div><button type="button" className="subtle-button" onClick={closeDetails}>{copy.close}</button></div>
      <div className="scheme-language-switch" role="group" aria-label="Scheme detail language">
        <button type="button" className={selected.contentLanguage === language ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, language)} disabled={detailLoading}>{copy.preferred}</button>
        {language !== 'en' && <button type="button" className={selected.contentLanguage === 'en' ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, 'en')} disabled={detailLoading}>{copy.original}</button>}
      </div>
      {detailLoading ? <LoadingBox label={copy.loading} /> : detailError ? <><ErrorNotice>{detailError}</ErrorNotice><p className="scheme-detail-description">{selected.description}</p><a href={selected.informationUrl} target="_blank" rel="noreferrer">{copy.official}</a></> : <>
      <p className="scheme-detail-description">{selected.description}</p>
      {selected.translation?.status === 'translated' && <p className="scheme-detail-language">{detailLabels.translatedNotice}</p>}
      {['unavailable', 'stale'].includes(selected.translation?.status) && <p className="scheme-detail-language">{detailLabels.unavailableNotice}</p>}
      <div className="scheme-detail-grid">
        <section><h3>{copy.requirements}</h3><p><b>{detailLabels.intendedFor}:</b> {selected.intendedFor}</p><p><b>{detailLabels.eligibility}:</b> {selected.eligibility}</p></section>
        <section><h3>{detailLabels.benefits}</h3><p>{selected.benefits}</p></section>
        <section><h3>{detailLabels.documents}</h3><p>{selected.documents}</p></section>
        <section><h3>{copy.apply}</h3><p>{selected.application}</p></section>
      </div>
      <div className="scheme-source"><ShieldCheck size={16} /><div><b>{copy.source}</b><p>{selected.department}</p><span>{extraLabels.verified} {selected.verificationDate}</span><a href={selected.translation?.sourceUrl || selected.informationUrl} target="_blank" rel="noreferrer">{selected.translation?.sourceUrl || selected.informationUrl}</a></div></div>
      <div className="scheme-detail-actions"><a className="primary-button" href={selected.applicationUrl} target="_blank" rel="noreferrer">{copy.apply}<ArrowRight size={16} /></a><a className="subtle-button" href={selected.informationUrl} target="_blank" rel="noreferrer">{copy.official}<ArrowRight size={16} /></a></div>
      </>}
    </Card></div>}
  </>;
}
