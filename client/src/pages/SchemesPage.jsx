import { useState, useEffect, useRef } from 'react';
import { Landmark, ShieldCheck, LoaderCircle, ArrowRight, Volume2, Square, Mic, MicOff, Languages } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import { supportedLanguages, localizedCopy } from '../services/languageStorage.js';
import { schemesCopy, schemeDetailLabels, schemeExtraLabels } from '../config/translations.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import { speakText, stopSpeaking, createSpeechRecognition } from '../services/voice.js';
import { getLanguageDefinition } from '../config/languages.js';

export default function SchemesPage() {
  const { farmer } = useFarm();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const langDef = getLanguageDefinition(language);
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

  // Voice speech & recognition states
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [speakingAll, setSpeakingAll] = useState(false);
  const [speakingSchemeId, setSpeakingSchemeId] = useState(null);
  const [speakingDetail, setSpeakingDetail] = useState(false);
  const [translatingAudio, setTranslatingAudio] = useState(false);
  const recognitionRef = useRef(null);
  const playbackRef = useRef(0);

  useEffect(() => {
    return () => {
      playbackRef.current += 1;
      stopSpeaking();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  async function load(explicitQuery) {
    setLoading(true); setError('');
    stopSpeaking();
    setSpeakingAll(false);
    setSpeakingSchemeId(null);
    try {
      const activeQuery = explicitQuery !== undefined ? explicitQuery : query;
      const params = { state: state || '', category };
      const { data } = activeQuery.trim()
        ? await api.get('/schemes/search', { params: { ...params, q: activeQuery.trim() } })
        : await api.get('/schemes', { params });
      setResult(data);
    } catch (e) { setResult(null); setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function categoryLabel(value) {
    return value === 'income-support' ? copy.income : value === 'crop-insurance' ? copy.insurance : value === 'water-management' ? copy.water : value;
  }

  function toggleVoiceSearch() {
    if (isListeningMic) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListeningMic(false);
      return;
    }

    const recognition = createSpeechRecognition(language);
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please type or try Google Chrome.');
      return;
    }

    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListeningMic(true);
    recognition.onerror = () => setIsListeningMic(false);
    recognition.onend = () => setIsListeningMic(false);
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        const cleaned = transcript.replace(/[.,?!]/g, '');
        setQuery(cleaned);
        load(cleaned);
      }
    };

    try {
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  }

  async function toggleSpeakAllSchemes() {
    if (speakingAll) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingAll(false);
      return;
    }

    if (!result?.schemes?.length) return;

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingSchemeId(null);
    setSpeakingAll(true);

    const intro = language === 'kn'
      ? 'ಲಭ್ಯವಿರುವ ಸರಕಾರಿ ಕೃಷಿ ಯೋಜನೆಗಳು:'
      : language === 'hi'
        ? 'उपलब्ध सरकारी कृषि योजनाएं:'
        : 'Available government agricultural schemes:';

    const items = result.schemes.slice(0, 5).map(s => `${s.name}. ${s.description}.`).join(' ');
    let fullText = `${intro} ${items}`;

    if (language !== 'en') {
      setTranslatingAudio(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text: fullText,
          targetLanguage: language
        });
        if (data?.translatedText) fullText = data.translatedText;
      } catch (err) {
        console.warn('Schemes summary translation failed:', err?.message);
      } finally {
        setTranslatingAudio(false);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(fullText, language);
    } finally {
      if (currentReq === playbackRef.current) setSpeakingAll(false);
    }
  }

  async function speakScheme(scheme) {
    if (speakingSchemeId === scheme.id) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingSchemeId(null);
      return;
    }

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingAll(false);
    setSpeakingSchemeId(scheme.id);

    let text = `${scheme.name}. ${scheme.description}. Intended for ${scheme.intendedFor}. Category: ${categoryLabel(scheme.category)}. Available in: ${scheme.states.join(', ')}.`;

    if (language !== 'en') {
      try {
        const { data } = await api.post('/ai/translate', {
          text,
          targetLanguage: language
        });
        if (data?.translatedText) text = data.translatedText;
      } catch (err) {
        console.warn('Scheme translation failed:', err?.message);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(text, language);
    } finally {
      if (currentReq === playbackRef.current) setSpeakingSchemeId(null);
    }
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
    stopSpeaking();
    setSpeakingDetail(false);
    setSelected(null);
    setDetailLoading(false);
    setDetailError('');
  }

  async function toggleSpeakDetail() {
    if (speakingDetail) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingDetail(false);
      return;
    }

    if (!selected) return;

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingDetail(true);

    let text = `${selected.name}. ${selected.description}. Requirements: intended for ${selected.intendedFor}. Eligibility: ${selected.eligibility}. Key Benefits: ${selected.benefits}. Required Documents: ${selected.documents}. How to Apply: ${selected.application}.`;

    if (language !== 'en' && selected.contentLanguage === 'en') {
      setTranslatingAudio(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text,
          targetLanguage: language
        });
        if (data?.translatedText) text = data.translatedText;
      } catch (err) {
        console.warn('Detail translation failed:', err?.message);
      } finally {
        setTranslatingAudio(false);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(text, language);
    } finally {
      if (currentReq === playbackRef.current) setSpeakingDetail(false);
    }
  }

  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={result?.dataType === 'verified-catalogue' ? <span className="scheme-data-badge"><ShieldCheck size={14} />{extraLabels.catalogue} · {result.verificationDate}</span> : null} />
    <Card className="scheme-catalogue-card">
      <form className="scheme-filter-form" onSubmit={event => { event.preventDefault(); load(); }}>
        <label className="field scheme-search-field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>{copy.search}</span>
            <button
              type="button"
              className={`voice-mic-btn ${isListeningMic ? 'listening' : ''}`}
              onClick={toggleVoiceSearch}
              title={isListeningMic ? 'Listening...' : 'Speak scheme name to search (ಧ್ವನಿಯಲ್ಲಿ ಹುಡುಕಿ)'}
            >
              {isListeningMic ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={language === 'kn' ? 'ಯೋಜನೆಯ ಹೆಸರು ಅಥವಾ ವಿಭಾಗ (ಧ್ವನಿಯಲ್ಲೂ ಹುಡುಕಬಹುದು)' : language === 'hi' ? 'योजना का नाम या श्रेणी' : 'Scheme name or keyword'}
          />
        </label>
        <label className="field"><span>{copy.state}</span><select value={state} onChange={event => setState(event.target.value)}><option value="">{copy.allStates}</option><option value="Karnataka">{extraLabels.karnataka}</option><option value="All India">{extraLabels.allIndia}</option></select></label>
        <label className="field"><span>{copy.category}</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">{copy.allCategories}</option><option value="income-support">{copy.income}</option><option value="crop-insurance">{copy.insurance}</option><option value="water-management">{copy.water}</option></select></label>
        <button className="primary-button scheme-search-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null}{copy.search}</button>
      </form>

      {/* Voice Schemes Summary Toolbar */}
      {result?.schemes?.length > 0 && (
        <div className="scheme-voice-bar">
          <button
            type="button"
            className={`primary-button voice-action-btn ${speakingAll ? 'active' : ''}`}
            onClick={toggleSpeakAllSchemes}
            disabled={translatingAudio}
            title="Listen to government schemes in your language"
          >
            {translatingAudio ? <LoaderCircle size={15} className="spin" /> : speakingAll ? <Square size={15} /> : <Volume2 size={15} />}
            <span>
              {translatingAudio
                ? (language === 'kn' ? 'ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ…' : 'Translating…')
                : speakingAll
                  ? (language === 'kn' ? 'ಮಾತು ನಿಲ್ಲಿಸಿ' : language === 'hi' ? 'बोलना बंद करें' : 'Stop speaking')
                  : (language === 'kn' ? 'ಯೋಜನೆಗಳನ್ನು ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ' : language === 'hi' ? 'योजनाएं आवाज़ में सुनें' : 'Listen to schemes')}
            </span>
          </button>
          <span style={{ fontSize: '11px', color: 'var(--ink-soft, #64748b)' }}>
            {language === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಧ್ವನಿ ವಿವರಣೆ (Sarvam AI)' : language === 'hi' ? 'हिंदी में आवाज़ विवरण (Sarvam AI)' : `${langDef?.nativeName || 'Regional'} Spoken Guidance`}
          </span>
        </div>
      )}

      {loading ? <LoadingBox label={copy.loading} /> : error ? <ErrorNotice retry={load}>{error}</ErrorNotice> : <>
        {result?.schemes?.length ? <div className="scheme-grid">{result.schemes.map(scheme => <article className="scheme-card" key={scheme.id}>
          <div className="scheme-card-head">
            <span className="scheme-level"><Landmark size={14} />{scheme.level === 'Central' ? copy.central : copy.stateScheme}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="scheme-category">{categoryLabel(scheme.category)}</span>
              <button
                type="button"
                className={`row-voice-btn ${speakingSchemeId === scheme.id ? 'active' : ''}`}
                onClick={() => speakScheme(scheme)}
                title={speakingSchemeId === scheme.id ? 'Stop speaking' : 'Listen to this scheme (ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ)'}
              >
                {speakingSchemeId === scheme.id ? <Square size={13} /> : <Volume2 size={13} />}
              </button>
            </div>
          </div>
          {scheme.potentiallyRelevant && <span className="scheme-relevance-badge">{copy.relevant} · {detailLabels.notEligibility}</span>}
          {scheme.translation?.status === 'translated' && <span className="scheme-translation-badge">{detailLabels.translatedNotice}</span>}
          <h2>{scheme.name}</h2><p>{scheme.description}</p>
          <div className="scheme-audience"><b>{scheme.intendedFor}</b><span>{scheme.states.map(value => value === 'All India' ? extraLabels.allIndia : value === 'Karnataka' ? extraLabels.karnataka : value).join(', ')}</span></div>
          <div className="scheme-card-actions">
            <button type="button" className="primary-button" onClick={() => showDetails(scheme)}>{copy.details}<ArrowRight size={15} /></button>
            <button
              type="button"
              className={`subtle-button scheme-voice-btn ${speakingSchemeId === scheme.id ? 'active' : ''}`}
              onClick={() => speakScheme(scheme)}
              title="Listen to this scheme in your language"
            >
              {speakingSchemeId === scheme.id ? <Square size={14} /> : <Volume2 size={14} />}
              <span>{speakingSchemeId === scheme.id ? (language === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Stop') : (language === 'kn' ? 'ಧ್ವನಿ' : language === 'hi' ? 'आवाज़' : 'Listen')}</span>
            </button>
            <a className="subtle-button" href={scheme.informationUrl} target="_blank" rel="noreferrer">{copy.official}<ArrowRight size={15} /></a>
          </div>
        </article>)}</div> : <div className="empty-state scheme-empty"><Landmark size={28} /><h3>{copy.noResults}</h3><p>Check the official myScheme portal for current records.</p><a className="primary-button" href={result?.mySchemeUrl || 'https://www.myscheme.gov.in/'} target="_blank" rel="noreferrer">{copy.myScheme}<ArrowRight size={16} /></a></div>}
      </>}
    </Card>
    {selected && <div className="scheme-detail-overlay" role="dialog" aria-modal="true" aria-label={selected.name} onMouseDown={event => { if (event.target === event.currentTarget) closeDetails(); }}><Card className="scheme-detail-card">
      <div className="scheme-detail-head"><div><span className="eyebrow">{categoryLabel(selected.category)} · {selected.level}</span><h2>{selected.name}</h2></div><button type="button" className="subtle-button" onClick={closeDetails}>{copy.close}</button></div>
      <div className="scheme-language-switch" role="group" aria-label="Scheme detail language">
        <button type="button" className={selected.contentLanguage === language ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, language)} disabled={detailLoading}>{copy.preferred}</button>
        {language !== 'en' && <button type="button" className={selected.contentLanguage === 'en' ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, 'en')} disabled={detailLoading}>{copy.original}</button>}
      </div>

      {/* Voice Readout Toolbar inside Scheme Details */}
      <div className="scheme-voice-bar" style={{ marginTop: '8px' }}>
        <button
          type="button"
          className={`primary-button voice-action-btn ${speakingDetail ? 'active' : ''}`}
          onClick={toggleSpeakDetail}
          disabled={translatingAudio}
          title="Listen to complete scheme details in your language"
        >
          {translatingAudio ? <LoaderCircle size={15} className="spin" /> : speakingDetail ? <Square size={15} /> : <Volume2 size={15} />}
          <span>
            {translatingAudio
              ? (language === 'kn' ? 'ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ…' : 'Translating…')
              : speakingDetail
                ? (language === 'kn' ? 'ಮಾತು ನಿಲ್ಲಿಸಿ' : 'Stop speaking')
                : (language === 'kn' ? 'ವಿವರಗಳನ್ನು ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ' : language === 'hi' ? 'विवरण आवाज़ में सुनें' : 'Listen to full details')}
          </span>
        </button>
        <span style={{ fontSize: '11px', color: 'var(--ink-soft, #64748b)' }}>
          {language === 'kn' ? 'ಕನ್ನಡ ಧ್ವನಿ ವಿವರಣೆ' : language === 'hi' ? 'हिंदी आवाज़ विवरण' : 'Spoken in regional language'}
        </span>
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
