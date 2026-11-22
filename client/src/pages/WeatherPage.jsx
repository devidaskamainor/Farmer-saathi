import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Droplets, Wind, CloudRain, ShieldCheck, Volume2, Square, LoaderCircle, Languages } from 'lucide-react';
import useFarm from '../hooks/useFarm.js';
import useRequest from '../hooks/useRequest.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';
import MetaLine from '../components/common/MetaLine.jsx';
import { Metric, WeatherIcon } from '../components/dashboard/WeatherWidgets.jsx';
import { speakText, stopSpeaking } from '../services/voice.js';
import { api } from '../services/api.js';
import { getLanguageDefinition } from '../config/languages.js';

export default function WeatherPage() {
  const { farmer } = useFarm();
  const weather = useRequest('/weather');

  // Voice playback & translation state
  const [speakingTarget, setSpeakingTarget] = useState(null); // 'all' | 'advisory' | dayIndex
  const [translating, setTranslating] = useState(false);
  const [translatedAdvisory, setTranslatedAdvisory] = useState('');
  const playbackRef = useRef(0);

  const preferredLang = farmer?.preferredLanguage || 'en';
  const langDef = getLanguageDefinition(preferredLang);

  useEffect(() => {
    return () => {
      playbackRef.current += 1;
      stopSpeaking();
    };
  }, []);

  async function handleToggleSpeakAll() {
    if (speakingTarget === 'all') {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingTarget(null);
      return;
    }

    if (!weather?.data) return;

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingTarget('all');

    const curr = weather.data.current;
    const loc = weather.data.location;
    const rainyDay = weather.data.forecast?.find(d => d.rainMm > 0);
    const advisory = rainyDay
      ? `Rain is forecast for ${new Date(`${rainyDay.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} with ${rainyDay.rainMm} mm rain. Check drainage before irrigating.`
      : 'No rainfall is listed in the 5-day forecast. Check soil moisture before irrigating.';

    let fullText = `Weather forecast for ${loc}. Currently ${Math.round(curr.temperatureC)} degrees Celsius with ${curr.conditions}. Humidity is ${curr.humidity} percent, wind is ${curr.windSpeedMs} meters per second. ${advisory}`;

    if (preferredLang !== 'en') {
      setTranslating(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text: fullText,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) {
          fullText = data.translatedText;
        }
      } catch (err) {
        console.warn('Translation failed, speaking in default:', err?.message);
      } finally {
        setTranslating(false);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(fullText, preferredLang);
    } finally {
      if (currentReq === playbackRef.current) {
        setSpeakingTarget(null);
      }
    }
  }

  async function handleSpeakDay(day, idx) {
    if (speakingTarget === idx) {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingTarget(null);
      return;
    }

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingTarget(idx);

    const dayName = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
    let text = `${dayName}: Maximum temperature ${Math.round(day.maxC)} degrees, minimum ${Math.round(day.minC)} degrees, ${day.conditions}, ${day.rainMm > 0 ? `${day.rainMm} mm rain expected.` : 'no rain expected.'}`;

    if (preferredLang !== 'en') {
      try {
        const { data } = await api.post('/ai/translate', {
          text,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) text = data.translatedText;
      } catch {}
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(text, preferredLang);
    } finally {
      if (currentReq === playbackRef.current) {
        setSpeakingTarget(null);
      }
    }
  }

  async function handleSpeakAdvisory(advisoryTitle, advisoryBody) {
    if (speakingTarget === 'advisory') {
      playbackRef.current += 1;
      stopSpeaking();
      setSpeakingTarget(null);
      return;
    }

    const currentReq = ++playbackRef.current;
    stopSpeaking();
    setSpeakingTarget('advisory');

    let text = `${advisoryTitle}. ${advisoryBody}`;

    if (preferredLang !== 'en') {
      setTranslating(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) {
          text = data.translatedText;
          setTranslatedAdvisory(text);
        }
      } catch (err) {
        console.warn('Advisory translation failed:', err?.message);
      } finally {
        setTranslating(false);
      }
    }

    if (currentReq !== playbackRef.current) return;

    try {
      await speakText(text, preferredLang);
    } finally {
      if (currentReq === playbackRef.current) {
        setSpeakingTarget(null);
      }
    }
  }

  return <>
    <PageTitle
      eyebrow="WEATHER ASSISTANT"
      title="Plan with the forecast"
      description="Forecasts are fetched from a weather service. Farming suggestions are estimates, not observations of your field."
      action={<Link className="subtle-button" to="/profile"><MapPin size={15} />{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Set location'}</Link>}
    />
    <Card className="content-card">
      {weather.loading ? <LoadingBox /> : weather.error ? <ErrorNotice retry={weather.load}>{weather.error}</ErrorNotice> : <>
        {/* Weather Voice & Regional Language Toolbar */}
        <div className="weather-voice-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`primary-button voice-action-btn ${speakingTarget === 'all' ? 'active' : ''}`}
              onClick={handleToggleSpeakAll}
              disabled={translating}
              title="Listen to full weather forecast in your language"
            >
              {translating ? <LoaderCircle size={15} className="spin" /> : speakingTarget === 'all' ? <Square size={15} /> : <Volume2 size={15} />}
              <span>
                {translating
                  ? 'Translating…'
                  : speakingTarget === 'all'
                    ? (preferredLang === 'kn' ? 'ಮಾತು ನಿಲ್ಲಿಸಿ' : preferredLang === 'hi' ? 'बोलना बंद करें' : 'Stop speaking')
                    : (preferredLang === 'kn' ? 'ಹವಾಮಾನ ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ' : preferredLang === 'hi' ? 'मौसम आवाज़ में सुनें' : 'Listen to forecast')}
              </span>
            </button>
            <span style={{ fontSize: '11px', color: 'var(--ink-soft, #64748b)' }}>
              {preferredLang === 'kn' ? 'ಕನ್ನಡದಲ್ಲಿ ಧ್ವನಿ ವಿವರಣೆ (Sarvam AI)' : preferredLang === 'hi' ? 'हिंदी में आवाज़ विवरण (Sarvam AI)' : `${langDef?.nativeName || 'Regional'} Voice Guidance`}
            </span>
          </div>
        </div>

        <div className="weather-detail-top">
          <div className="weather-big-icon"><WeatherIcon conditions={weather.data.current.conditions} size={31} /></div>
          <div>
            <span className="eyebrow">{weather.data.location}</span>
            <div className="big-temperature">{Math.round(weather.data.current.temperatureC)}°<span>C</span></div>
            <p className="capitalize">{weather.data.current.conditions}</p>
          </div>
          <div className="weather-detail-metrics">
            <Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} />
            <Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} />
            <Metric icon={CloudRain} label="Rainfall" value={`${weather.data.current.rainfallMm} mm`} />
          </div>
        </div>

        <div className="section-heading compact-heading">
          <div><span className="eyebrow">NEXT DAYS</span><h2>{weather.data.forecast.length}-day forecast</h2></div>
          <span className="small-muted">Local forecast dates</span>
        </div>

        <div className="forecast-grid">
          {weather.data.forecast.map((day, idx) => (
            <div className="forecast-day" key={day.date}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                <button
                  type="button"
                  className={`row-voice-btn ${speakingTarget === idx ? 'active' : ''}`}
                  onClick={() => handleSpeakDay(day, idx)}
                  title="Listen to this day's weather (ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ)"
                >
                  {speakingTarget === idx ? <Square size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
              <WeatherIcon conditions={day.conditions} size={21} />
              <b>{Math.round(day.maxC)}° <i>{Math.round(day.minC)}°</i></b>
              <span className="forecast-rain"><Droplets size={13} />{day.rainMm} mm rain</span>
              <span className="forecast-condition">{day.conditions}</span>
            </div>
          ))}
        </div>

        {(() => {
          const rainyDay = weather.data.forecast.find(day => day.rainMm > 0);
          const advisoryTitle = rainyDay ? `Rain is forecast for ${new Date(`${rainyDay.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Use the forecast as a planning aid';
          const advisoryBody = rainyDay ? `The service reports ${rainyDay.rainMm} mm of forecast rain for that date. Check drainage and field moisture before planning irrigation; local conditions may differ.` : 'No rainfall is listed in the returned forecast. Check soil moisture before irrigating; forecast detail may not reflect your exact village.';

          return (
            <div className="weather-advisory" style={{ position: 'relative' }}>
              <div className="advisory-icon"><ShieldCheck size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <b>{advisoryTitle}</b>
                  <button
                    type="button"
                    className={`advisory-voice-btn ${speakingTarget === 'advisory' ? 'active' : ''}`}
                    onClick={() => handleSpeakAdvisory(advisoryTitle, advisoryBody)}
                    title="Listen to this advisory in your language (ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ)"
                  >
                    {speakingTarget === 'advisory' ? <Square size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
                <p>{translatedAdvisory || advisoryBody}</p>
                {translatedAdvisory && (
                  <small style={{ color: 'var(--green, #16a34a)', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                    ✓ Translated to {langDef?.nativeName || 'regional language'}
                  </small>
                )}
              </div>
            </div>
          );
        })()}
        <MetaLine source={weather.data.source} time={weather.data.fetchedAt} />
      </>}
    </Card>
  </>;
}
