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
    setChecking(true);
    api.get('/auth/session')
      .then(({ data }) => {
        if (!active) return;
        setAuthenticated(true);
        setFarmer(data.farmer);
        setProfileError('');
      })
      .catch(error => {
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
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [location.pathname]);

  useEffect(() => {
    if (farmer?.preferredLanguage && supportedLanguages.has(farmer.preferredLanguage)) saveLanguage(farmer.preferredLanguage);
  }, [farmer?.preferredLanguage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname);
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
          .then(res => res.json())
          .then(googleUser => {
            if (googleUser?.email) {
              return api.post('/auth/social', {
                provider: 'google',
                email: googleUser.email,
                name: googleUser.name || googleUser.given_name || googleUser.email.split('@')[0],
                preferredLanguage: readSavedLanguage() || 'en'
              });
            }
          })
          .then(response => {
            if (response?.data) onAuthenticated(response.data);
          })
          .catch(err => {
            setProfileError(errorMessage(err));
          });
      }
    }
  }, []);

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

    const handleContinueAsGuest = () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('farmer_saathi_token');
      }
      const guestFarmer = {
        _id: 'guest-farmer',
        name: 'Devidas Kamainor',
        email: 'devdevudevidaskaminor@gmail.com',
        preferredLanguage: readSavedLanguage() || 'kn',
        state: 'Karnataka',
        district: 'Hassan',
        village: 'Nittur Buzurg',
        farmSize: 5,
        currentCrops: ['Sugarcane', 'Cotton']
      };
      setFarmer(guestFarmer);
      setAuthenticated(true);
      setProfileError('');
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
          <button className="subtle-button" onClick={handleContinueAsGuest}>
            Continue as Demo Farmer
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
