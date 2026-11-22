import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { applyTheme, getSavedTheme } from '../services/theme.js';
import { getLanguageDefinition } from '../config/languages.js';
import { readSavedLanguage, saveLanguage, supportedLanguages } from '../services/languageStorage.js';
import { getBrowserHelpLanguage } from '../utils/authHelpUtils.js';
import AppShell from '../components/layout/AppShell.jsx';
import AuthPage from '../pages/AuthPage.jsx';
import EmailVerificationPage from '../pages/EmailVerificationPage.jsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import WeatherPage from '../pages/WeatherPage.jsx';
import MarketsPage from '../pages/MarketsPage.jsx';
import CropsPage from '../pages/CropsPage.jsx';
import AssistantPage from '../pages/AssistantPage.jsx';
import IrrigationPage from '../pages/IrrigationPage.jsx';
import DiseasePage from '../pages/DiseasePage.jsx';
import SchemesPage from '../pages/SchemesPage.jsx';
import SatellitePage from '../pages/SatellitePage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';

if (typeof window !== 'undefined') {
  applyTheme(getSavedTheme());
}

const publicAuthPaths = new Set(['/verify-email', '/forgot-password', '/reset-password']);

export default function App() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(false);
  const [farmer, setFarmer] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    const definition = getLanguageDefinition(farmer?.preferredLanguage || readSavedLanguage() || getBrowserHelpLanguage());
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
  }, [farmer?.preferredLanguage]);

  useEffect(() => {
    let active = true;

    if (publicAuthPaths.has(location.pathname)) {
      setChecking(false);
      return () => { active = false; };
    }

    async function initializeAuth() {
      setChecking(true);

      // 1. Check for incoming Google authentication redirect tokens (id_token or credential)
      if (typeof window !== 'undefined') {
        const hash = window.location.hash ? window.location.hash.substring(1) : '';
        const search = window.location.search ? window.location.search.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(search);

        const idToken = hashParams.get('id_token') || hashParams.get('credential') ||
                        searchParams.get('id_token') || searchParams.get('credential');

        if (idToken) {
          window.history.replaceState(null, '', window.location.pathname);
          try {
            const { data } = await api.post('/auth/google', {
              idToken,
              preferredLanguage: readSavedLanguage() || 'en'
            });
            if (!active) return;
            onAuthenticated(data);
            setChecking(false);
            return;
          } catch (err) {
            if (!active) return;
            setProfileError(errorMessage(err));
            setAuthenticated(false);
            setFarmer(null);
            setChecking(false);
            return;
          }
        }
      }

      // 2. No incoming Google token, check existing session (Bearer token / session cookie)
      try {
        const { data } = await api.get('/auth/session');
        if (!active) return;
        setAuthenticated(true);
        setFarmer(data.farmer);
        if (data.token && typeof window !== 'undefined') {
          localStorage.setItem('farmer_saathi_token', data.token);
        }
        setProfileError('');
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401 || error.response?.status === 403) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('farmer_saathi_token');
          }
          setAuthenticated(false);
          setFarmer(null);
          setProfileError('');
        } else {
          setProfileError(errorMessage(error));
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    initializeAuth();

    return () => { active = false; };
  }, [location.pathname]);

  useEffect(() => {
    if (farmer?.preferredLanguage && supportedLanguages.has(farmer.preferredLanguage)) saveLanguage(farmer.preferredLanguage);
  }, [farmer?.preferredLanguage]);

  const onAuthenticated = (data) => {
    if (data?.token && typeof window !== 'undefined') {
      localStorage.setItem('farmer_saathi_token', data.token);
    }
    setAuthenticated(true);
    setFarmer(data?.farmer || null);
    setProfileError('');
  };
  const signOut = async () => {
    try { await api.post('/auth/logout'); }
    catch (error) { window.alert(errorMessage(error)); }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('farmer_saathi_token');
    }
    setAuthenticated(false);
    setFarmer(null);
  };

  if (location.pathname === '/verify-email') {
    return <EmailVerificationPage onAuthenticated={onAuthenticated} />;
  }
  if (location.pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (location.pathname === '/reset-password') return <ResetPasswordPage />;
  if (checking) return <div className="full-loading"><LoaderCircle className="spin" /><span>Opening your farm…</span></div>;
  if (profileError && !farmer) {
    const handleResetSession = () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('farmer_saathi_token');
      }
      setProfileError('');
      setAuthenticated(false);
      setFarmer(null);
    };

    return (
      <div className="error-screen">
        <ShieldCheck size={36} />
        <h1>Could not connect to your account</h1>
        <p>{profileError}</p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="primary-button" onClick={() => window.location.reload()}>
            Try again
          </button>
          <button className="subtle-button" onClick={handleResetSession}>
            Sign in again
          </button>
        </div>
      </div>
    );
  }
  if (!authenticated) return <AuthPage onAuthenticated={onAuthenticated} />;
  if (!farmer) return <div className="full-loading"><LoaderCircle className="spin" /><span>Loading your profile…</span></div>;

  return <Routes>
    <Route element={<AppShell farmer={farmer} setFarmer={setFarmer} onSignOut={signOut} />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="weather" element={<WeatherPage />} />
      <Route path="markets" element={<MarketsPage />} />
      <Route path="crops" element={<CropsPage />} />
      <Route path="assistant" element={<AssistantPage />} />
      <Route path="irrigation" element={<IrrigationPage />} />
      <Route path="disease" element={<DiseasePage />} />
      <Route path="satellite" element={<SatellitePage />} />
      <Route path="schemes" element={<SchemesPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}
