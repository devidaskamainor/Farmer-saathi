import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud, Sprout, FileWarning, Droplets, BadgeIndianRupee, Landmark,
  MessageCircle, Leaf, UserRound, Volume2, VolumeX, Mic, ArrowRight
} from 'lucide-react';
import { speakText, stopSpeaking } from '../../services/voice.js';
import { supportedLanguages, localizedCopy } from '../../services/languageStorage.js';
import { serviceCopy, defaultServiceItems } from '../../config/translations.js';
import { authHelpContent } from '../../config/authTranslations.js';
import Card from '../common/Card.jsx';

export default function VoiceWelcome({ farmer }) {
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(serviceCopy, language);
  const [speechNotice, setSpeechNotice] = useState('');
  const firstName = farmer?.name?.split(' ')[0] || '';
  const serviceLinks = [
    ['weather', '/weather', Cloud],
    ['crops', '/crops', Sprout],
    ['disease', '/disease', FileWarning],
    ['irrigation', '/irrigation', Droplets],
    ['markets', '/markets', BadgeIndianRupee],
    ['schemes', '/schemes', Landmark],
    ['assistant', '/assistant', MessageCircle],
    ['cropHealth', '/disease', Leaf],
    ['profile', '/profile', UserRound]
  ];

  async function readWelcome() {
    const response = await speakText(`${copy.greeting(firstName)} ${copy.intro}`, language);
    if (response.ok || response.reason === 'cancelled') setSpeechNotice('');
    else {
      const helpCopy = localizedCopy(authHelpContent, language);
      setSpeechNotice(response.reason === 'unsupported' ? helpCopy.speechUnsupported : helpCopy.voiceMissing);
    }
  }

  return <Card className="voice-welcome-card">
    <div className="voice-welcome-head">
      <span className="assistant-avatar" aria-hidden="true"><Leaf size={22} /></span>
      <div className="voice-welcome-copy">
        <span className="eyebrow">{copy.title}</span>
        <h2>{copy.greeting(firstName)}</h2>
        <p>{copy.intro}</p>
      </div>
    </div>
    <div className="voice-welcome-actions">
      <button className="primary-button voice-start-button" type="button" onClick={readWelcome}>
        <Volume2 size={18} />
        <span>{copy.start}</span>
      </button>
      <button className="subtle-button voice-stop-button" type="button" onClick={stopSpeaking}>
        <VolumeX size={17} />
        <span>{copy.stop}</span>
      </button>
      <Link className="subtle-button voice-chat-link" to="/assistant">
        <Mic size={18} />
        <span>{copy.talk}</span>
      </Link>
    </div>
    {speechNotice && <p className="voice-welcome-notice" role="status">{speechNotice}</p>}
    <h3 className="voice-services-title">{copy.servicesTitle}</h3>
    <div className="voice-service-grid">
      {serviceLinks.map(([key, to, Icon]) => {
        const item = copy.services?.[key] || defaultServiceItems[key];
        const [title, description, action] = item;
        return (
          <Link
            className="voice-service-card"
            to={to}
            key={key}
            aria-label={`${title}: ${description}`}
          >
            <div className="card-top">
              <span className="feature-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
            </div>
            <div className="card-body">
              <b className="card-title">{title}</b>
              <span className="card-desc">{description}</span>
            </div>
            <div className="card-action">
              <strong>{action}</strong>
              <ArrowRight size={15} aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  </Card>;
}
