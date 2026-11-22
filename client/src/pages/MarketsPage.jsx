import { useState, useEffect, useRef } from 'react';
import { LoaderCircle, BadgeIndianRupee, Volume2, Square, Mic, MicOff, Languages } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import useFarm from '../hooks/useFarm.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import MetaLine from '../components/common/MetaLine.jsx';
import MandiTrendCharts, { formatRupees } from '../components/dashboard/MandiTrendCharts.jsx';
import { speakText, stopSpeaking, createSpeechRecognition } from '../services/voice.js';

export default function MarketsPage() {
  const { farmer } = useFarm();
  const [filters, setFilters] = useState({ commodity: '', market: '', state: farmer?.state || '', district: farmer?.district || '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice speech & recognition states
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [speakingAll, setSpeakingAll] = useState(false);
  const [speakingRowIdx, setSpeakingRowIdx] = useState(null);
  const [translatingAudio, setTranslatingAudio] = useState(false);
  const recognitionRef = useRef(null);
  const playbackRef = useRef(0);

  const preferredLang = farmer?.preferredLanguage || 'en';

  useEffect(() => {
    return () => {
      playbackRef.current += 1;
      stopSpeaking();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  async function search(event, explicitFilters) {
    event?.preventDefault();
    stopSpeaking();
    setSpeakingAll(false);
    setSpeakingRowIdx(null);
    setLoading(true);
    setError('');
    const activeFilters = explicitFilters || filters;
    try {
      const { data } = await api.get('/mandi/compare', { params: activeFilters });
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); }, []);

  function toggleVoiceCommoditySearch() {
    if (isListeningMic) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListeningMic(false);
      return;
    }

    const recognition = createSpeechRecognition(preferredLang);
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please type crop name or try Google Chrome.');
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
        const updated = { ...filters, commodity: cleaned };
        setFilters(updated);
        search(undefined, updated);
      }
    };

    try {
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  }

  async function toggleSpeakAllPrices() {
    if (speakingAll) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingAll(false);
      return;
    }

    if (!result?.records?.length) return;

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingRowIdx(null);
    setSpeakingAll(true);

    const topRecords = result.records.slice(0, 5);
    const summaryIntro = `Market price report for ${filters.commodity || 'crops'} in ${filters.district || filters.state || 'markets'}.`;
    const details = topRecords.map(r =>
      `At ${r.market} mandi, ${r.commodity} modal price is ${r.modalPrice ? `${r.modalPrice} rupees` : 'not reported'}.`
    ).join(' ');
    let fullText = `${summaryIntro} ${details}`;

    // Translate if preferred language is regional (e.g. Kannada, Hindi, Marathi, etc.)
    if (preferredLang !== 'en') {
      setTranslatingAudio(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text: fullText,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) {
          fullText = data.translatedText;
        }
      } catch (err) {
        console.warn('Failed to translate mandi summary, speaking English:', err?.message);
      } finally {
        setTranslatingAudio(false);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(fullText, preferredLang);
    } finally {
      if (currentReq === playbackRef.current) {
        setSpeakingAll(false);
      }
    }
  }

  async function speakRowPrice(row, index) {
    if (speakingRowIdx === index) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingRowIdx(null);
      return;
    }

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingAll(false);
    setSpeakingRowIdx(index);

    let text = `In ${row.market} market, ${row.commodity} minimum price is ${row.minPrice || 'not reported'} rupees, maximum price is ${row.maxPrice || 'not reported'} rupees, and modal price is ${row.modalPrice || 'not reported'} rupees.`;

    if (preferredLang !== 'en') {
      try {
        const { data } = await api.post('/ai/translate', {
          text,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) {
          text = data.translatedText;
        }
      } catch {}
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(text, preferredLang);
    } finally {
      if (currentReq === playbackRef.current) {
        setSpeakingRowIdx(null);
      }
    }
  }

  return <>
    <PageTitle eyebrow="MARKET INTELLIGENCE" title="Know the mandi price" description="Browse reported prices from the official market data source. Each record carries its market date." />
    <Card className="content-card">
      <form onSubmit={search} className="filter-form">
        <label className="field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Crop or commodity</span>
            <button
              type="button"
              className={`voice-mic-btn ${isListeningMic ? 'listening' : ''}`}
              onClick={toggleVoiceCommoditySearch}
              title={isListeningMic ? 'Listening to voice...' : 'Speak crop name to search (ಧ್ವನಿಯಲ್ಲಿ ಹುಡುಕಿ)'}
            >
              {isListeningMic ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
          <input
            type="text"
            placeholder="e.g. Rice or ಟೊಮ್ಯಾಟೊ"
            value={filters.commodity}
            onChange={e => setFilters({ ...filters, commodity: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Market</span>
          <input
            type="text"
            placeholder="Optional market name"
            value={filters.market}
            onChange={e => setFilters({ ...filters, market: e.target.value })}
          />
        </label>
        <label className="field">
          <span>State</span>
          <input
            type="text"
            placeholder="e.g. Karnataka"
            value={filters.state}
            onChange={e => setFilters({ ...filters, state: e.target.value })}
          />
        </label>
        <label className="field">
          <span>District</span>
          <input
            type="text"
            placeholder="e.g. Bidar"
            value={filters.district}
            onChange={e => setFilters({ ...filters, district: e.target.value })}
          />
        </label>
        <button className="primary-button search-button" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={17} /> : null}Search prices
        </button>
      </form>

      {loading && <LoadingBox label="Fetching reported market records…" />}
      {error && !loading && <ErrorNotice retry={search}>{error}</ErrorNotice>}

      {!loading && !error && result && <>
        <div className="results-heading">
          <div>
            <span className="eyebrow">{result.total} RECORDS</span>
            <h2>Available mandi prices</h2>
          </div>
          <span className="rupee-note">Unit shown only when reported</span>
        </div>

        {/* Spoken Price Summary Voice Toolbar */}
        {result.records.length > 0 && (
          <div className="mandi-voice-bar">
            <button
              type="button"
              className={`primary-button voice-action-btn ${speakingAll ? 'active' : ''}`}
              onClick={toggleSpeakAllPrices}
              disabled={translatingAudio}
              title="Listen to price summary in your language"
            >
              {translatingAudio ? <LoaderCircle size={15} className="spin" /> : speakingAll ? <Square size={15} /> : <Volume2 size={15} />}
              <span>
                {translatingAudio
                  ? 'Translating summary…'
                  : speakingAll
                    ? (preferredLang === 'kn' ? 'ಮಾತು ನಿಲ್ಲಿಸಿ' : preferredLang === 'hi' ? 'बोलना बंद करें' : 'Stop speaking')
                    : (preferredLang === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ' : preferredLang === 'hi' ? 'बाज़ार भाव आवाज़ में सुनें' : 'Listen to market prices')}
              </span>
            </button>
            <span style={{ fontSize: '11px', color: 'var(--ink-soft, #64748b)' }}>
              {preferredLang === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಧ್ವನಿ ವಿವರಣೆ' : preferredLang === 'hi' ? 'हिंदी में आवाज़ विवरण' : 'Spoken in regional language'}
            </span>
          </div>
        )}

        {result.records.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Voice</th>
                  <th>Commodity</th>
                  <th>Mandi</th>
                  <th>Market date</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Modal</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {result.records.map((row, i) => (
                  <tr key={`${row.market}-${row.commodity}-${row.marketDate}-${i}`}>
                    <td>
                      <button
                        type="button"
                        className={`row-voice-btn ${speakingRowIdx === i ? 'active' : ''}`}
                        onClick={() => speakRowPrice(row, i)}
                        title="Listen to this price (ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ)"
                      >
                        {speakingRowIdx === i ? <Square size={13} /> : <Volume2 size={13} />}
                      </button>
                    </td>
                    <td><b>{row.commodity || '—'}</b></td>
                    <td>{row.market || '—'}<small>{row.district}{row.state ? `, ${row.state}` : ''}</small></td>
                    <td>{row.marketDate || 'Not reported'}</td>
                    <td>{formatRupees(row.minPrice)}</td>
                    <td>{formatRupees(row.maxPrice)}</td>
                    <td className="modal-price">{formatRupees(row.modalPrice)}</td>
                    <td>{row.priceUnit || 'Not reported'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <BadgeIndianRupee size={28} />
            <h3>No records found</h3>
            <p>Try a wider location or a different crop. No price is estimated when records are missing.</p>
          </div>
        )}
        <MandiTrendCharts trends={result.trends || []} source={result.source} />
        <MetaLine source={result.source} time={result.fetchedAt} />
      </>}
    </Card>
  </>;
}
