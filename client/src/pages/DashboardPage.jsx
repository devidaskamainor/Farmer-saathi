import { Link } from 'react-router-dom';
import {
  MapPin, ArrowRight, Sun, Leaf, CalendarDays, Cloud,
  Droplets, Wind, CloudRain, BadgeIndianRupee, Sprout,
  MessageCircle, ShieldCheck, Satellite
} from 'lucide-react';
import useFarm from '../hooks/useFarm.js';
import useRequest from '../hooks/useRequest.js';
import { words } from '../config/translations.js';
import Card from '../components/common/Card.jsx';
import LoadingBox from '../components/common/LoadingBox.jsx';
import MetaLine from '../components/common/MetaLine.jsx';
import VoiceWelcome from '../components/dashboard/VoiceWelcome.jsx';
import PlannerPanel from '../components/dashboard/PlannerPanel.jsx';
import FarmHistoryPanel from '../components/dashboard/FarmHistoryPanel.jsx';
import { Metric, WeatherIcon, PriceRow } from '../components/dashboard/WeatherWidgets.jsx';

export default function DashboardPage() {
  const { farmer } = useFarm();
  const t = words[farmer?.preferredLanguage] || words.en;
  const weather = useRequest('/weather');
  const market = useRequest(`/mandi/prices?state=${encodeURIComponent(farmer?.state || '')}&district=${encodeURIComponent(farmer?.district || '')}`);
  const locationName = [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ');
  const firstName = farmer?.name?.split(' ')[0] || '';

  return <>
    <div className="welcome-band"><div className="welcome-copy"><span className="eyebrow light-eyebrow">{t.welcome}, {firstName}</span><h1>{t.dashboard}</h1><p>A clearer view of the day, with useful guidance for what comes next.</p><div className="welcome-location"><MapPin size={15} />{locationName || <Link to="/profile">{t.location} <ArrowRight size={14} /></Link>}</div></div><div className="welcome-art"><div className="sun-disc"><Sun size={33} /></div><div className="hill hill-back" /><div className="hill hill-front" /><div className="art-leaf art-leaf-one"><Leaf /></div><div className="art-leaf art-leaf-two"><Leaf /></div></div></div>
    <VoiceWelcome farmer={farmer} />
    <div className="dashboard-planner"><PlannerPanel compact /></div>
    <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Your daily picture</h2></div><span className="date-stamp"><CalendarDays size={16} />{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div className="dashboard-grid">
      <Card className="weather-summary"><div className="card-head"><div><span className="eyebrow">{t.forecast.toUpperCase()}</span><h3>Weather outlook</h3></div><Link className="icon-link" to="/weather" aria-label="Open weather"><ArrowRight size={18} /></Link></div>
        {weather.loading ? <LoadingBox label="Checking forecast…" /> : weather.error ? <div className="empty-block"><Cloud size={25} /><p>{weather.error}</p><Link to="/weather">Open weather <ArrowRight size={14} /></Link></div> : <><div className="current-weather"><div className="weather-symbol"><WeatherIcon conditions={weather.data.current.conditions} size={27} /></div><div><strong>{Math.round(weather.data.current.temperatureC)}°</strong><span>{weather.data.current.conditions}</span></div><div className="weather-place"><MapPin size={14} />{weather.data.location}</div></div><div className="weather-metrics"><Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} /><Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} /><Metric icon={CloudRain} label="Rain now" value={`${weather.data.current.rainfallMm} mm`} /></div><MetaLine source={weather.data.source} time={weather.data.fetchedAt} /></>}
      </Card>
      <Card className="market-summary"><div className="card-head"><div><span className="eyebrow">LOCAL MARKETS</span><h3>Reported mandi prices</h3></div><Link className="icon-link" to="/markets" aria-label="Open mandi prices"><ArrowRight size={18} /></Link></div>
        {market.loading ? <LoadingBox label="Checking market data…" /> : market.error ? <div className="empty-block"><BadgeIndianRupee size={25} /><p>{market.error}</p><Link to="/markets">Search mandi prices <ArrowRight size={14} /></Link></div> : market.data.records.length ? <><div className="price-list">{market.data.records.slice(0, 4).map((row, i) => <PriceRow key={`${row.market}-${row.commodity}-${i}`} row={row} />)}</div><MetaLine source={market.data.source} time={market.data.fetchedAt} /></> : <div className="empty-block"><BadgeIndianRupee size={25} /><p>No records matched your saved location. Search another district or crop.</p><Link to="/markets">Search market prices <ArrowRight size={14} /></Link></div>}
      </Card>
      <Link to="/crops" className="card feature-card crop-feature"><div className="feature-top"><span className="feature-icon"><Sprout size={20} /></span><span className="pill">PERSONALIZED</span></div><div><h3>Which crop fits your farm?</h3><p>Get ideas based on the details you’ve shared, with missing information called out.</p><span className="text-link">Explore crop advice <ArrowRight size={16} /></span></div></Link>
      <Link to="/satellite" className="card feature-card satellite-feature"><div className="feature-top"><span className="feature-icon"><Satellite size={20} /></span><span className="pill pill-soft">SENTINEL-2 MSI</span></div><div><h3>Satellite Crop Monitoring</h3><p>Track live NDVI canopy vigor, water deficit, and 3x3 zoning from space.</p><span className="text-link">Monitor farm plot <ArrowRight size={16} /></span></div></Link>
      <Link to="/assistant" className="card feature-card ask-feature"><div className="feature-top"><span className="feature-icon"><MessageCircle size={20} /></span><span className="pill pill-soft">HERE TO HELP</span></div><div><h3>A question came up?</h3><p>Ask in your preferred language about crops, weather, soil or farm care.</p><span className="text-link">Ask Saathi <ArrowRight size={16} /></span></div></Link>
      <Card className="tip-card"><div className="tip-icon"><ShieldCheck size={20} /></div><div><span className="eyebrow">A NOTE ON ADVICE</span><p>Weather and market information shows its source and date. AI suggestions are guidance, not a confirmed diagnosis or local expert assessment.</p></div></Card>
    </div>
    <div className="dashboard-history"><FarmHistoryPanel compact /></div>
  </>;
}
