import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe2, Leaf, Volume2, VolumeX, Plus, House, UserRound,
  Check, Mic, MicOff, LoaderCircle, Send
} from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { stopSpeaking } from '../services/voice.js';
import useFarm from '../hooks/useFarm.js';
import { languageConfig } from '../config/languages.js';
import { serviceCopy, assistantCopy } from '../config/translations.js';
import { supportedLanguages, localizedCopy } from '../services/languageStorage.js';
import PageTitle from '../components/common/PageTitle.jsx';
import Card from '../components/common/Card.jsx';
import ErrorNotice from '../components/common/ErrorNotice.jsx';

export default function AssistantPage() {
  const { farmer, setFarmer } = useFarm();
  const navigate = useNavigate();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(assistantCopy, language);
  const firstName = farmer?.name?.split(' ')[0] || '';
  const serviceText = localizedCopy(serviceCopy, language);
  const greeting = `${serviceText.greeting(firstName)} ${serviceText.intro}`;
  const [messages, setMessages] = useState([{ role: 'assistant', answer: greeting }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [locationRequest, setLocationRequest] = useState('');
  const [locationToConfirm, setLocationToConfirm] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const transcriptionAbortRef = useRef(null);
  const speechAbortRef = useRef(null);
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const playbackRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(recordingTimerRef.current);
      transcriptionAbortRef.current?.abort();
      speechAbortRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      chunksRef.current = [];
      releaseMicrophone();
      stopAudio(false);
      for (const url of audioCacheRef.current.values()) URL.revokeObjectURL(url);
      audioCacheRef.current.clear();
      stopSpeaking();
    };
  }, []);

  function handleVoiceCommand(message) {
    const text = message.toLocaleLowerCase();
    if (/^(repeat|दोहराएं|पुनः सुनाएं|ಮತ್ತೆ ಹೇಳಿ|ಮತ್ತೆ ಕೇಳಿ|மீண்டும்|మళ్ళీ వినండి|पुन्हा सांगा|আবার শুনুন|ફરી સાંભળો|വീണ്ടും കേൾക്കുക|ਮੁੜ ਸੁਣੋ|ପୁଣି ଶୁଣନ୍ତୁ|পুনৰ শুনক|دوبارہ سنیں)$/.test(text)) {
      const lastAssistant = [...messages].reverse().find(item => item.role === 'assistant');
      if (lastAssistant) speak(lastAssistant.answer);
      return true;
    }
    if (/^(home|main menu|मुख्य पृष्ठ|होम|ಮುಖ್ಯ ಪುಟ|ಹೋಮ್|முகப்பு|ప్రధాన పేజీ|প্রধান পাতা|ਮੁੱਖ ਪੰਨਾ|مرکزی صفحہ)$/.test(text)) { navigate('/dashboard'); return true; }
    if (/^(stop speaking|रुकिए|बोलना बंद करें|ಮಾತು ನಿಲ್ಲಿಸಿ|ನಿಲ್ಲಿಸಿ|நிறுத்து|ఆపండి|थांबवा|বন্ধ করুন|બંધ કરો|നിർത്തുക|ਬੰਦ ਕਰੋ|ବନ୍ଦ କରନ୍ତୁ|কোৱা বন্ধ কৰক|بولنا بند کریں)$/.test(text)) { stopAudio(); return true; }
    if (/^(new conversation|नई बातचीत|ಹೊಸ ಸಂಭಾಷಣೆ|புதிய உரையாடல்|కొత్త సంభాషణ|नवीन संभाषण|নতুন বার্তালাপ|નવી વાતચીત|പുതിയ സംഭാഷണം|ਨਵੀਂ ਗੱਲਬਾਤ|ନୂଆ କଥାବାର୍ତ୍ତା|নতুন কথোপকথন|نئی گفتگو)$/.test(text)) { startNewConversation(); return true; }
    if (/weather|हवामान|मौसम|ಹವಾಮಾನ|வானிலை|వాతావరణం|আবহাওয়া|હવામાન|കാലാവസ്ഥ|ਮੌਸਮ|ପାଣିପାଗ|বতৰ|موسم/.test(text)) { navigate('/weather'); return true; }
    if (/mandi|market|भाव|मंडी|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ|சந்தை|మార్కెట్|বাজার|બજાર|വിപണി|ਮੰਡੀ|ମଣ୍ଡି|বজাৰ|منڈی/.test(text)) { navigate('/markets'); return true; }
    if (/crop disease|crop problem|रोग|बीमारी|ಬೆಳೆ ಸಮಸ್ಯೆ|ರೋಗ|நோய்|తెగులు|कीड|রোগ|રોગ|രോഗം|ਬਿਮਾਰੀ|ରୋଗ|ৰোগ|بیماری/.test(text)) { navigate('/disease'); return true; }
    if (/irrigation|supply|सिंचाई|पानी|ನೀರಾವರಿ|நீர்ப்பಾசனம்|నీటిಪಾರುదల|सिंचन|সেচ|સિંચાઈ|ജലಸೇಚനം|ਸਿੰਚਾਈ|ଜଳସେଚନ|জলসিঞ্চন|آبپاشی/.test(text)) { navigate('/irrigation'); return true; }
    if (/crop recommendation|choose crop|फसल चुन|फसल सलाह|ಬೆಳೆ ಆಯ್ಕೆ|ಬೆಳೆ ಸಲಹೆ|பயிர்|పంట|पीक सल्ला|ফসল|પાક|വിള|ਫ਼ਸਲ|ଫସଲ|শস্য|فصل/.test(text)) { navigate('/crops'); return true; }
    return false;
  }

  async function speak(text) {
    setSpeechError('');
    const voice = languageConfig[language]?.sarvamTts;
    if (!voice) {
      setSpeechError(copy.speechUnavailable);
      return;
    }
    if (!text || text.length > 2500) {
      setSpeechError(copy.speechTooLong);
      return;
    }

    stopAudio();
    const requestId = playbackRequestRef.current;
    const cacheKey = `${language}:${text}`;
    let url = audioCacheRef.current.get(cacheKey);
    try {
      if (!url) {
        const controller = new AbortController();
        speechAbortRef.current = controller;
        const response = await api.post('/voice/speak', { text, language }, {
          responseType: 'blob',
          timeout: 45000,
          signal: controller.signal
        });
        if (!response.data?.size) throw new Error('Empty audio response');
        url = URL.createObjectURL(response.data);
        audioCacheRef.current.set(cacheKey, url);
        while (audioCacheRef.current.size > 3) {
          const oldestKey = audioCacheRef.current.keys().next().value;
          URL.revokeObjectURL(audioCacheRef.current.get(oldestKey));
          audioCacheRef.current.delete(oldestKey);
        }
      }
      if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (mountedRef.current) setPlayingAudio(false);
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (mountedRef.current) {
          setPlayingAudio(false);
          setSpeechError(copy.speechError);
        }
      };
      await audio.play();
      if (mountedRef.current) setPlayingAudio(true);
    } catch (playbackError) {
      if (playbackError?.name !== 'CanceledError' && playbackError?.name !== 'AbortError' && mountedRef.current) {
        setSpeechError(playbackError?.response ? errorMessage(playbackError) : copy.speechError);
      }
    }
  }

  function stopAudio(updateState = true) {
    playbackRequestRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (updateState && mountedRef.current) setPlayingAudio(false);
  }

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function sendText(message, bypassLocationConfirmation = false) {
    const text = String(message || '').trim();
    if (!text || (loading && !bypassLocationConfirmation)) return;
    if (locationRequest && !bypassLocationConfirmation) {
      setInput('');
      setMessages(old => [...old, { role: 'user', answer: text }, { role: 'assistant', answer: copy.confirmLocation(text) }]);
      setLocationToConfirm(text);
      return;
    }
    if (!bypassLocationConfirmation && handleVoiceCommand(text)) return;
    setInput('');
    setError('');
    setSpeechError('');
    setMessages(old => [...old, { role: 'user', answer: text }]);
    setLoading(true);
    try {
      const history = [...messages, { role: 'user', answer: text }].slice(-8).map(item => ({ role: item.role, text: item.answer }));
      const { data } = await api.post('/ai/ask', { message: text, history });
      setMessages(old => [...old, { role: 'assistant', answer: data.answer }]);
      if (data.action === 'open_schemes') navigate('/schemes');
      if (data.action === 'ask_location') setLocationRequest(text);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }

  async function send(event) {
    event?.preventDefault();
    await sendText(input);
  }

  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechError(copy.voiceUnsupported);
      return;
    }
    const langDef = languageConfig[language];
    if (langDef && !langDef.sttSupported) {
      setSpeechError(copy.voiceUnsupported);
      return;
    }
    setSpeechError('');
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      discardRecordingRef.current = false;
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearTimeout(recordingTimerRef.current);
        discardRecordingRef.current = true;
        chunksRef.current = [];
        releaseMicrophone();
        if (mountedRef.current) {
          setListening(false);
          setSpeechError(copy.voiceError);
        }
      };
      recorder.onstop = async () => {
        clearTimeout(recordingTimerRef.current);
        const discardRecording = discardRecordingRef.current;
        discardRecordingRef.current = false;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const mimetype = blob.type.split(';')[0].toLowerCase();
        releaseMicrophone();
        if (!mountedRef.current || discardRecording) return;
        setListening(false);
        if (!blob.size) {
          setSpeechError(copy.voiceError);
          return;
        }
        if (blob.size > 5 * 1024 * 1024) {
          setSpeechError(copy.clipTooLarge);
          return;
        }
        const formData = new FormData();
        const extension = mimetype === 'audio/mp4' ? 'm4a' : 'webm';
        formData.append('audio', blob, `recording.${extension}`);
        formData.append('language', language);
        const controller = new AbortController();
        transcriptionAbortRef.current = controller;
        setTranscribing(true);
        try {
          const { data } = await api.post('/voice/transcribe', formData, {
            timeout: 45000,
            signal: controller.signal
          });
          if (!mountedRef.current) return;
          setInput(data.transcript || '');
          setSpeechError(data.transcript ? copy.reviewSpeech : copy.voiceError);
        } catch (transcriptionError) {
          if (transcriptionError?.name !== 'CanceledError' && transcriptionError?.name !== 'AbortError' && mountedRef.current) {
            setSpeechError(errorMessage(transcriptionError));
          }
        } finally {
          if (mountedRef.current) setTranscribing(false);
        }
      };
      recorder.start(250);
      setListening(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 28_000);
    } catch {
      releaseMicrophone();
      setListening(false);
      setSpeechError(copy.voiceError);
    }
  }

  function stopListening() {
    clearTimeout(recordingTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else {
      releaseMicrophone();
      setListening(false);
    }
  }

  function startNewConversation() {
    if (recorderRef.current?.state === 'recording') discardRecordingRef.current = true;
    stopListening();
    transcriptionAbortRef.current?.abort();
    setTranscribing(false);
    stopAudio();
    setMessages([{ role: 'assistant', answer: greeting }]);
    setInput('');
    setError('');
    setSpeechError('');
    setLocationRequest('');
    setLocationToConfirm('');
  }

  async function confirmLocation() {
    if (!locationToConfirm) return;
    const originalRequest = locationRequest;
    setLoading(true);
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, { village: locationToConfirm });
      setFarmer(data.farmer);
      setMessages(old => [...old, { role: 'assistant', answer: copy.saved(locationToConfirm) }]);
      setLocationRequest('');
      setLocationToConfirm('');
      await sendText(originalRequest, true);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }

  function cancelLocation() {
    setMessages(old => [...old, { role: 'assistant', answer: copy.cancel }]);
    setLocationRequest('');
    setLocationToConfirm('');
  }

  const lastAssistant = [...messages].reverse().find(item => item.role === 'assistant');
  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={<span className="language-badge"><Globe2 size={15} />{languageConfig[language]?.nativeName || languageConfig.en.nativeName}</span>} />
    <Card className="chat-card">
      <div className="chat-heading"><span className="assistant-avatar"><Leaf size={19} /></span><div><b>Saathi</b><span>{copy.eyebrow} · {languageConfig[language]?.nativeName || languageConfig.en.nativeName}</span></div><span className="chat-status"><span className="status-dot" />{copy.ready}</span></div>
      <div className="assistant-actions" aria-label="Assistant actions">
        <button type="button" onClick={() => lastAssistant && speak(lastAssistant.answer)}><Volume2 size={16} />{copy.listen}</button>
        <button type="button" onClick={() => lastAssistant && speak(lastAssistant.answer)}><Volume2 size={16} />{copy.repeat}</button>
        <button type="button" onClick={() => stopAudio()}><VolumeX size={16} />{copy.stopSpeaking}</button>
        <button type="button" onClick={startNewConversation}><Plus size={16} />{copy.newConversation}</button>
        <button type="button" onClick={() => navigate('/dashboard')}><House size={16} />{copy.home}</button>
      </div>
      <div className="message-list">{messages.map((message, i) => <div key={i} className={`message-row ${message.role === 'user' ? 'message-user' : ''}`}><div className="message-avatar">{message.role === 'assistant' ? <Leaf size={14} /> : <UserRound size={14} />}</div><div className="message-content"><div className={`message-bubble ${message.role === 'user' ? 'bubble-user' : ''}`}>{message.answer}</div>{message.role === 'assistant' && <button className="speak-button" type="button" onClick={() => speak(message.answer)}><Volume2 size={14} />{copy.listen}</button>}</div></div>)}{loading && <div className="typing-indicator"><span /><span /><span /> Saathi is thinking…</div>}</div>
      {locationToConfirm && <div className="location-confirm"><button className="primary-button" type="button" onClick={confirmLocation}><Check size={17} />{copy.confirm}</button><button className="subtle-button" type="button" onClick={cancelLocation}>{copy.change}</button></div>}
      {error && <div className="chat-error"><ErrorNotice>{error}</ErrorNotice></div>}
      {(speechError || (!languageConfig[language]?.sarvamTts && !speechError)) && <p className="chat-speech-notice" role="status">{speechError || copy.speechUnavailable}</p>}
      <form className="chat-composer" onSubmit={send}>
        <button className={`mic-button ${listening ? 'mic-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} disabled={loading || transcribing} aria-label={listening ? copy.stopListening : transcribing ? copy.transcribing : copy.microphone}>{listening ? <MicOff size={18} /> : transcribing ? <LoaderCircle className="spin" size={18} /> : <Mic size={18} />}</button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={copy.composer} aria-label={copy.composer} />
        <button className="send-button" disabled={!input.trim() || loading || listening || transcribing} aria-label={copy.send}><Send size={18} /></button>
      </form>
      <div className="composer-note">{transcribing ? copy.transcribing : listening ? copy.listening : copy.voicePrivacy}{playingAudio ? ` ${copy.stopSpeaking}.` : ''}</div>
    </Card>
  </>;
}
