import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  House, Cloud, BadgeIndianRupee, Sprout, MessageCircle, Droplets,
  Activity, UserRound, Leaf, LogOut, Menu, Globe2, ChevronDown
} from 'lucide-react';
import { api, errorMessage } from '../../services/api.js';
import { saveLanguage } from '../../services/languageStorage.js';
import ThemePicker from '../common/ThemePicker.jsx';
import { languageOptions } from '../../config/languages.js';
import { words } from '../../config/translations.js';

export const nav = [
  { to: '/dashboard', key: 'overview', icon: House },
  { to: '/weather', key: 'weather', icon: Cloud },
  { to: '/markets', key: 'markets', icon: BadgeIndianRupee },
  { to: '/crops', key: 'crops', icon: Sprout },
  { to: '/assistant', key: 'assistant', icon: MessageCircle },
  { to: '/irrigation', key: 'irrigation', icon: Droplets },
  { to: '/disease', key: 'disease', icon: Activity },
  { to: '/profile', key: 'profile', icon: UserRound }
];

export default function AppShell({ farmer, setFarmer, onSignOut }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const t = words[farmer?.preferredLanguage] || words.en;
  const location = useLocation();
  const page = nav.find(item => item.to === location.pathname);
  const initials = farmer?.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'F';

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  async function changeLanguage(value) {
    saveLanguage(value);
    setFarmer(prev => prev ? { ...prev, preferredLanguage: value } : prev);
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, { preferredLanguage: value });
      setFarmer(data.farmer);
      saveLanguage(data.farmer.preferredLanguage);
    } catch (error) { window.alert(errorMessage(error)); }
  }

  return <div className="app-shell">
    {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link to="/dashboard" className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></Link>
      <div className="side-section-label">YOUR FARM</div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(({ to, key, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileNav(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{t[key]}</span>{key === 'assistant' && <span className="nav-new">AI</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="helper-card"><div className="helper-icon"><Sprout size={18} /></div><b>Growing takes care.</b><span>Take one decision at a time.</span></div>
        <button className="signout-button" onClick={onSignOut}><LogOut size={17} />{t.signOut}</button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button><div className="crumbs"><span>Farmer Saathi</span><span className="crumb-slash">/</span><b>{t[page?.key] || t.overview}</b></div>
        <div className="topbar-right">
          <ThemePicker />
          <span className="topbar-divider" />
          <label className="language-control"><Globe2 size={16} /><span className="sr-only">{t.language}</span><select aria-label={t.language} value={farmer?.preferredLanguage || 'en'} onChange={e => changeLanguage(e.target.value)}>{languageOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={13} /></label>
          <span className="topbar-divider" />
          <div className="user-chip"><span className="avatar">{initials}</span><span className="user-name">{farmer?.name?.split(' ')[0]}</span></div>
        </div>
      </header>
      {offline && <div className="offline-banner" role="status">You’re offline. Live weather, market data, and account updates are unavailable; no cached forecast or price is shown.</div>}
      <div className="page-content"><Outlet context={{ farmer, setFarmer }} /></div>
    </main>
  </div>;
}
