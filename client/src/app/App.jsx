import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Activity, ArrowRight, BadgeIndianRupee, CalendarDays, Check, ChevronDown, ChevronLeft,
  Cloud, CloudRain, Droplets, FileWarning, Globe2, House, Leaf, LoaderCircle, LogOut, MapPin,
  Landmark, Menu, MessageCircle, Mic, MicOff, Plus, Save, Send, ShieldCheck, Sprout, Sun,
  Upload, UserRound, Volume2, VolumeX, Wind
} from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { supabase } from '../config/supabase.js';
import { createSpeechRecognition, speakText, stopSpeaking } from '../services/voice.js';

const words = {
  en: { overview: 'Overview', weather: 'Weather', markets: 'Mandi prices', crops: 'Crop advice', assistant: 'Ask Saathi', irrigation: 'Irrigation', disease: 'Crop health', profile: 'My farm', welcome: 'Good day', dashboard: 'Your farm at a glance', forecast: 'Weather outlook', market: 'Market watch', recommendations: 'Crop recommendations', quickAsk: 'Ask a farming question', location: 'Add your farm location', language: 'Language', save: 'Save changes', loading: 'Loading…', noData: 'No data available yet', signOut: 'Sign out', farmProfile: 'Farm profile', back: 'Back to overview', source: 'Source', updated: 'Updated', tryAgain: 'Try again', crop: 'Crop', district: 'District', state: 'State' },
  hi: { overview: 'मुख्य पृष्ठ', weather: 'मौसम', markets: 'मंडी भाव', crops: 'फसल सलाह', assistant: 'साथी से पूछें', irrigation: 'सिंचाई', disease: 'फसल स्वास्थ्य', profile: 'मेरा खेत', welcome: 'नमस्कार', dashboard: 'आपके खेत की जानकारी', forecast: 'मौसम पूर्वानुमान', market: 'बाज़ार भाव', recommendations: 'फसल सुझाव', quickAsk: 'खेती का सवाल पूछें', location: 'अपने खेत का स्थान जोड़ें', language: 'भाषा', save: 'बदलाव सहेजें', loading: 'लोड हो रहा है…', noData: 'अभी कोई जानकारी उपलब्ध नहीं', signOut: 'साइन आउट', farmProfile: 'खेत की जानकारी', back: 'मुख्य पृष्ठ पर लौटें', source: 'स्रोत', updated: 'अपडेट', tryAgain: 'फिर कोशिश करें', crop: 'फसल', district: 'ज़िला', state: 'राज्य' },
  kn: { overview: 'ಮುಖ್ಯ ಪುಟ', weather: 'ಹವಾಮಾನ', markets: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ', crops: 'ಬೆಳೆ ಸಲಹೆ', assistant: 'ಸಾಥಿಗೆ ಕೇಳಿ', irrigation: 'ನೀರಾವರಿ', disease: 'ಬೆಳೆ ಆರೋಗ್ಯ', profile: 'ನನ್ನ ಹೊಲ', welcome: 'ನಮಸ್ಕಾರ', dashboard: 'ನಿಮ್ಮ ಹೊಲದ ಮಾಹಿತಿ', forecast: 'ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ', market: 'ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ', recommendations: 'ಬೆಳೆ ಶಿಫಾರಸುಗಳು', quickAsk: 'ಕೃಷಿ ಪ್ರಶ್ನೆ ಕೇಳಿ', location: 'ನಿಮ್ಮ ಹೊಲದ ಸ್ಥಳ ಸೇರಿಸಿ', language: 'ಭಾಷೆ', save: 'ಬದಲಾವಣೆ ಉಳಿಸಿ', loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…', noData: 'ಇನ್ನೂ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ', signOut: 'ಸೈನ್ ಔಟ್', farmProfile: 'ಹೊಲದ ವಿವರ', back: 'ಮುಖ್ಯ ಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ', source: 'ಮೂಲ', updated: 'ನವೀಕರಿಸಲಾಗಿದೆ', tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', crop: 'ಬೆಳೆ', district: 'ಜಿಲ್ಲೆ', state: 'ರಾಜ್ಯ' }
};

const authHelpContent = {
  en: {
    name: 'English', title: 'Need help? Ask Saathi', subtitle: 'I can guide you through signing in or creating an account.',
    greeting: 'Hello! Choose a question or type one below. Never share your password or one-time code in this chat.',
    prompts: [['login', 'How do I sign in?'], ['register', 'How do I create an account?'], ['email', 'Email confirmation'], ['password', 'I forgot my password']],
    answers: {
      login: 'To sign in, leave “Sign in” selected, enter the email address and password you used when registering, then tap “Sign in”. Enter your password only in the Password field, never in this chat.',
      register: 'To create an account, choose “Create an account” below. Enter your name, email address, and a password with at least 8 characters, then tap “Create account”. If you receive a confirmation email, open its link and return here to sign in. You can add your farm details after signing up.',
      email: 'If sign-up asks you to confirm your email, open the message from Farmer Saathi and tap its confirmation link. Check your Spam or Junk folder too. After confirming, return here and sign in with the same email and password.',
      password: 'For your safety, Saathi cannot see or recover your password. Do not share it here or with anyone. Password reset is not available on this sign-in screen yet; please ask the person who manages your Farmer Saathi account to help reset it.',
      other: 'I can help with signing in, creating an account, email confirmation, or a forgotten password. Pick one of the question buttons or ask in your own words.'
    },
    placeholder: 'Type a question about your account…', send: 'Send', voice: 'Speak your question', stopVoice: 'Stop listening', listen: 'Listen', language: 'Assistant language',
    voiceLanguageHint: 'Before speaking, choose the language you will use from the menu above.',
    voiceUnsupported: 'Voice input is not available in this browser. Type your question instead.', voiceError: 'Microphone could not start. Check browser microphone permission, or type your question.',
    speechUnsupported: 'Spoken answers are not available in this browser.', speechReview: 'I heard you. Review the words, then tap Send.',
    voiceMissing: 'This device has no speech voice for the selected language. I left the answer as text instead of reading it in the wrong language. Add a voice for this language in device speech settings and restart the browser.',
    privacy: 'Saathi does not need your password or one-time code. Questions are answered in this page; your browser may process voice input.'
  },
  hi: {
    name: 'हिन्दी', title: 'मदद चाहिए? साथी से पूछें', subtitle: 'मैं लॉग इन करने या खाता बनाने में मदद करूँगा।',
    greeting: 'नमस्ते! नीचे कोई सवाल चुनें या लिखें। इस चैट में अपना पासवर्ड या ओटीपी कभी न दें।',
    prompts: [['login', 'लॉग इन कैसे करें?'], ['register', 'खाता कैसे बनाएं?'], ['email', 'ईमेल की पुष्टि'], ['password', 'पासवर्ड भूल गया']],
    answers: {
      login: 'लॉग इन करने के लिए “Sign in” चुनें। अपना पंजीकृत ईमेल और पासवर्ड भरें, फिर “Sign in” दबाएँ। पासवर्ड केवल Password वाले खाने में लिखें, इस चैट में नहीं।',
      register: 'खाता बनाने के लिए नीचे “Create an account” चुनें। अपना नाम, ईमेल और कम से कम 8 अक्षरों का पासवर्ड भरें, फिर “Create account” दबाएँ। पुष्टि वाला ईमेल आए तो उसका लिंक खोलें, फिर यहाँ लौटकर लॉग इन करें। खेत की जानकारी बाद में जोड़ सकते हैं।',
      email: 'अगर पंजीकरण के बाद ईमेल की पुष्टि माँगी जाए, Farmer Saathi का ईमेल खोलकर उसमें दिया लिंक दबाएँ। Spam या Junk फ़ोल्डर भी देखें। पुष्टि के बाद इसी ईमेल और पासवर्ड से लॉग इन करें।',
      password: 'आपकी सुरक्षा के लिए साथी आपका पासवर्ड देख या वापस नहीं बता सकता। इसे यहाँ या किसी से साझा न करें। इस लॉग इन स्क्रीन पर पासवर्ड रीसेट की सुविधा अभी नहीं है; अपना खाता सँभालने वाले व्यक्ति से मदद माँगें।',
      other: 'मैं लॉग इन, नया खाता बनाने, ईमेल की पुष्टि या भूले हुए पासवर्ड में मदद कर सकता हूँ। नीचे सवाल चुनें या अपना सवाल लिखें।'
    },
    placeholder: 'अपने खाते के बारे में सवाल लिखें…', send: 'भेजें', voice: 'बोलकर सवाल पूछें', stopVoice: 'सुनना बंद करें', listen: 'सुनें', language: 'सहायक की भाषा',
    voiceLanguageHint: 'बोलने से पहले ऊपर दिए मेनू में अपनी भाषा चुनें।',
    voiceUnsupported: 'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। अपना सवाल टाइप करें।', voiceError: 'माइक्रोफ़ोन शुरू नहीं हुआ। ब्राउज़र की माइक्रोफ़ोन अनुमति जाँचें या सवाल टाइप करें।',
    speechUnsupported: 'इस ब्राउज़र में जवाब सुनने की सुविधा उपलब्ध नहीं है।', speechReview: 'आपकी बात लिख ली गई है। पढ़कर देखें, फिर भेजें।',
    voiceMissing: 'इस डिवाइस में चुनी हुई भाषा की आवाज़ उपलब्ध नहीं है। गलत भाषा में पढ़ने के बजाय जवाब टेक्स्ट में रखा है। डिवाइस की वाणी सेटिंग में इस भाषा की आवाज़ जोड़ें और ब्राउज़र फिर से खोलें।',
    privacy: 'साथी को आपका पासवर्ड या ओटीपी नहीं चाहिए। सवाल इसी पेज पर जवाब पाते हैं; आवाज़ को आपका ब्राउज़र संसाधित कर सकता है।'
  },
  kn: {
    name: 'ಕನ್ನಡ', title: 'ಸಹಾಯ ಬೇಕೇ? ಸಾಥಿಯನ್ನು ಕೇಳಿ', subtitle: 'ಲಾಗಿನ್ ಮಾಡಲು ಅಥವಾ ಖಾತೆ ತೆರೆಯಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
    greeting: 'ನಮಸ್ಕಾರ! ಕೆಳಗಿನ ಪ್ರಶ್ನೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ. ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಒಟಿಪಿಯನ್ನು ಈ ಚಾಟ್‌ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.',
    prompts: [['login', 'ಲಾಗಿನ್ ಮಾಡುವುದು ಹೇಗೆ?'], ['register', 'ಖಾತೆ ತೆರೆಯುವುದು ಹೇಗೆ?'], ['email', 'ಇಮೇಲ್ ದೃಢೀಕರಣ'], ['password', 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿದ್ದೇನೆ']],
    answers: {
      login: 'ಲಾಗಿನ್ ಮಾಡಲು “Sign in” ಆಯ್ಕೆಮಾಡಿ. ನೋಂದಣಿಗೆ ಬಳಸಿದ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ, ನಂತರ “Sign in” ಒತ್ತಿ. ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು Password ಜಾಗದಲ್ಲಷ್ಟೇ ನಮೂದಿಸಿ; ಈ ಚಾಟ್‌ನಲ್ಲಿ ಬರೆಯಬೇಡಿ.',
      register: 'ಖಾತೆ ತೆರೆಯಲು ಕೆಳಗಿನ “Create an account” ಆಯ್ಕೆಮಾಡಿ. ನಿಮ್ಮ ಹೆಸರು, ಇಮೇಲ್ ಮತ್ತು ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ, ನಂತರ “Create account” ಒತ್ತಿ. ದೃಢೀಕರಣ ಇಮೇಲ್ ಬಂದರೆ ಅದರ ಲಿಂಕ್ ತೆರೆಯಿರಿ, ನಂತರ ಇಲ್ಲಿ ಬಂದು ಲಾಗಿನ್ ಮಾಡಿ. ಹೊಲದ ವಿವರಗಳನ್ನು ನಂತರ ಸೇರಿಸಬಹುದು.',
      email: 'ನೋಂದಣಿಯ ನಂತರ ಇಮೇಲ್ ದೃಢೀಕರಣ ಕೇಳಿದರೆ, Farmer Saathi ಕಳುಹಿಸಿದ ಸಂದೇಶದಲ್ಲಿನ ಲಿಂಕ್ ಒತ್ತಿ. Spam ಅಥವಾ Junk ಫೋಲ್ಡರ್ ಕೂಡ ಪರಿಶೀಲಿಸಿ. ದೃಢೀಕರಿಸಿದ ನಂತರ ಅದೇ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್‌ನಿಂದ ಲಾಗಿನ್ ಮಾಡಿ.',
      password: 'ನಿಮ್ಮ ಸುರಕ್ಷತೆಗಾಗಿ ಸಾಥಿಗೆ ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಕಾಣುವುದಿಲ್ಲ ಅಥವಾ ಅದನ್ನು ಮರಳಿ ಪಡೆಯಲು ಸಾಧ್ಯವಿಲ್ಲ. ಅದನ್ನು ಇಲ್ಲಿ ಅಥವಾ ಯಾರೊಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ. ಈ ಲಾಗಿನ್ ಪುಟದಲ್ಲಿ ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸುವ ಆಯ್ಕೆ ಈಗಿಲ್ಲ; ನಿಮ್ಮ Farmer Saathi ಖಾತೆಯನ್ನು ನಿರ್ವಹಿಸುವವರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      other: 'ಲಾಗಿನ್, ಹೊಸ ಖಾತೆ ತೆರೆಯುವುದು, ಇಮೇಲ್ ದೃಢೀಕರಣ ಅಥವಾ ಮರೆತ ಪಾಸ್‌ವರ್ಡ್ ಕುರಿತು ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು. ಕೆಳಗಿನ ಪ್ರಶ್ನೆ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.'
    },
    placeholder: 'ನಿಮ್ಮ ಖಾತೆಯ ಬಗ್ಗೆ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ…', send: 'ಕಳುಹಿಸಿ', voice: 'ಮಾತನಾಡಿ ಪ್ರಶ್ನೆ ಕೇಳಿ', stopVoice: 'ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ', listen: 'ಕೇಳಿ', language: 'ಸಹಾಯಕ ಭಾಷೆ',
    voiceLanguageHint: 'ಮಾತನಾಡುವ ಮೊದಲು ಮೇಲಿನ ಮೆನುವಿನಲ್ಲಿ ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    voiceUnsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬರವಣಿಗೆ ಲಭ್ಯವಿಲ್ಲ. ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.', voiceError: 'ಮೈಕ್ರೊಫೋನ್ ಆರಂಭವಾಗಲಿಲ್ಲ. ಬ್ರೌಸರ್ ಅನುಮತಿ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ.',
    speechUnsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಉತ್ತರವನ್ನು ಧ್ವನಿಯಾಗಿ ಕೇಳಲು ಸಾಧ್ಯವಿಲ್ಲ.', speechReview: 'ನಿಮ್ಮ ಮಾತು ಬರೆಯಲಾಗಿದೆ. ಪರಿಶೀಲಿಸಿ ನಂತರ ಕಳುಹಿಸಿ.',
    voiceMissing: 'ಈ ಸಾಧನದಲ್ಲಿ ಆಯ್ಕೆಮಾಡಿದ ಭಾಷೆಯ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ತಪ್ಪು ಭಾಷೆಯಲ್ಲಿ ಓದುವುದನ್ನು ತಪ್ಪಿಸಲು ಉತ್ತರವನ್ನು ಪಠ್ಯವಾಗಿಯೇ ತೋರಿಸಿದ್ದೇನೆ. ಸಾಧನದ ಮಾತಿನ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಸೇರಿಸಿ, ಬ್ರೌಸರ್ ಮರುಪ್ರಾರಂಭಿಸಿ.',
    privacy: 'ಸಾಥಿಗೆ ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಒಟಿಪಿ ಅಗತ್ಯವಿಲ್ಲ. ಪ್ರಶ್ನೆಗಳಿಗೆ ಈ ಪುಟದಲ್ಲೇ ಉತ್ತರಿಸಲಾಗುತ್ತದೆ; ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿಯನ್ನು ಸಂಸ್ಕರಿಸಬಹುದು.'
  }
};

const authCopy = {
  en: {
    languageTitle: 'Choose your language', languageDescription: 'Tap the language you understand best. You can change it later.', continue: 'Continue', changeLanguage: 'Change language',
    loginTitle: 'Welcome back', loginDescription: 'Sign in with the email and password for your Farmer Saathi account.',
    registerTitle: 'Create your account', registerDescription: 'Choose a simple form or let Saathi guide you one question at a time.',
    name: 'Your name', email: 'Email address', password: 'Password', namePlaceholder: 'For example, Ramesh', emailPlaceholder: 'you@example.com',
    passwordPlaceholder: 'At least 8 characters', signIn: 'Sign in', createAccount: 'Create account', switchToRegister: 'New to Farmer Saathi?', switchToLogin: 'Already have an account?',
    useSignIn: 'Sign in', useRegister: 'Create an account', visualMode: 'Simple form', voiceMode: 'Voice-guided setup', optional: 'Optional',
    village: 'Village or town', district: 'District', state: 'State', crops: 'Crops you grow', villagePlaceholder: 'Village or nearby town', districtPlaceholder: 'Your district', statePlaceholder: 'Your state', cropsPlaceholder: 'For example, tomato',
    step: 'Question', next: 'Next', skip: 'Skip this', back: 'Back', repeatQuestion: 'Repeat question', speakAnswer: 'Speak your answer', stopListening: 'Stop listening', listening: 'Listening… speak now',
    manualHint: 'Tap the microphone to answer by voice, or type below. You can skip details you do not know.', recognitionUnavailable: 'Voice input is not available in this browser. Type your answer instead.', microphoneError: 'Microphone did not start. Allow microphone access in your browser or type your answer.',
    reviewTitle: 'Check your details', reviewQuestion: 'Are these details correct?', notProvided: 'Not provided', changeInfo: 'Change information', confirmInfo: 'Confirm details', credentialsTitle: 'Secure account details', credentialsHint: 'Enter your email and password here. Never speak or share your password in the assistant.',
    accountCreate: 'Create secure account', confirmation: 'Check your email for a confirmation link. Once confirmed, return here and sign in.',
    privacy: 'Your details are saved to your private account.', languageWelcome: 'Language selected. I can guide you through creating an account or signing in.'
  },
  hi: {
    languageTitle: 'अपनी भाषा चुनें', languageDescription: 'जिस भाषा को आप अच्छी तरह समझते हैं, उसे चुनें। बाद में बदल सकते हैं।', continue: 'आगे बढ़ें', changeLanguage: 'भाषा बदलें',
    loginTitle: 'वापस स्वागत है', loginDescription: 'अपने Farmer Saathi खाते के ईमेल और पासवर्ड से लॉग इन करें।',
    registerTitle: 'अपना खाता बनाएं', registerDescription: 'सरल फ़ॉर्म चुनें या साथी से एक-एक सवाल पूछने को कहें।',
    name: 'आपका नाम', email: 'ईमेल पता', password: 'पासवर्ड', namePlaceholder: 'उदाहरण: रमेश', emailPlaceholder: 'you@example.com',
    passwordPlaceholder: 'कम से कम 8 अक्षर', signIn: 'लॉग इन करें', createAccount: 'खाता बनाएं', switchToRegister: 'Farmer Saathi पर नए हैं?', switchToLogin: 'पहले से खाता है?',
    useSignIn: 'लॉग इन', useRegister: 'खाता बनाएं', visualMode: 'सरल फ़ॉर्म', voiceMode: 'आवाज़ से जानकारी दें', optional: 'ज़रूरी नहीं',
    village: 'गाँव या कस्बा', district: 'ज़िला', state: 'राज्य', crops: 'आपकी फसलें', villagePlaceholder: 'गाँव या पास का कस्बा', districtPlaceholder: 'आपका ज़िला', statePlaceholder: 'आपका राज्य', cropsPlaceholder: 'उदाहरण: टमाटर',
    step: 'सवाल', next: 'आगे', skip: 'छोड़ें', back: 'वापस', repeatQuestion: 'सवाल फिर सुनें', speakAnswer: 'बोलकर जवाब दें', stopListening: 'सुनना बंद करें', listening: 'सुन रहा हूँ… अब बोलें',
    manualHint: 'माइक्रोफ़ोन दबाकर बोलें या नीचे लिखें। जो जानकारी नहीं पता, उसे छोड़ सकते हैं।', recognitionUnavailable: 'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। जवाब टाइप करें।', microphoneError: 'माइक्रोफ़ोन शुरू नहीं हुआ। ब्राउज़र में अनुमति दें या जवाब टाइप करें।',
    reviewTitle: 'अपनी जानकारी जाँचें', reviewQuestion: 'क्या यह जानकारी सही है?', notProvided: 'नहीं दी', changeInfo: 'जानकारी बदलें', confirmInfo: 'जानकारी की पुष्टि करें', credentialsTitle: 'खाते की सुरक्षित जानकारी', credentialsHint: 'ईमेल और पासवर्ड यहाँ लिखें। पासवर्ड सहायक को न बोलें और किसी से साझा न करें।',
    accountCreate: 'सुरक्षित खाता बनाएं', confirmation: 'पुष्टि लिंक के लिए अपना ईमेल देखें। पुष्टि के बाद यहाँ लौटकर लॉग इन करें।',
    privacy: 'आपकी जानकारी आपके निजी खाते में सहेजी जाती है।', languageWelcome: 'भाषा चुनी गई। मैं खाता बनाने या लॉग इन करने में आपकी मदद कर सकता हूँ।'
  },
  kn: {
    languageTitle: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ', languageDescription: 'ನಿಮಗೆ ಚೆನ್ನಾಗಿ ಅರ್ಥವಾಗುವ ಭಾಷೆಯನ್ನು ಒತ್ತಿ. ನಂತರ ಬದಲಾಯಿಸಬಹುದು.', continue: 'ಮುಂದುವರಿಸಿ', changeLanguage: 'ಭಾಷೆ ಬದಲಿಸಿ',
    loginTitle: 'ಮತ್ತೆ ಸ್ವಾಗತ', loginDescription: 'ನಿಮ್ಮ Farmer Saathi ಖಾತೆಯ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಬಳಸಿ ಲಾಗಿನ್ ಮಾಡಿ.',
    registerTitle: 'ನಿಮ್ಮ ಖಾತೆ ತೆರೆಯಿರಿ', registerDescription: 'ಸರಳ ಫಾರ್ಮ್ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಸಾಥಿ ಒಂದೊಂದು ಪ್ರಶ್ನೆ ಕೇಳಲಿ.',
    name: 'ನಿಮ್ಮ ಹೆಸರು', email: 'ಇಮೇಲ್ ವಿಳಾಸ', password: 'ಪಾಸ್‌ವರ್ಡ್', namePlaceholder: 'ಉದಾಹರಣೆ: ರಮೇಶ್', emailPlaceholder: 'you@example.com',
    passwordPlaceholder: 'ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು', signIn: 'ಲಾಗಿನ್ ಮಾಡಿ', createAccount: 'ಖಾತೆ ತೆರೆಯಿರಿ', switchToRegister: 'Farmer Saathi ಗೆ ಹೊಸಬರೇ?', switchToLogin: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?',
    useSignIn: 'ಲಾಗಿನ್', useRegister: 'ಖಾತೆ ತೆರೆಯಿರಿ', visualMode: 'ಸರಳ ಫಾರ್ಮ್', voiceMode: 'ಧ್ವನಿ ಮಾರ್ಗದರ್ಶನ', optional: 'ಐಚ್ಛಿಕ',
    village: 'ಗ್ರಾಮ ಅಥವಾ ಊರು', district: 'ಜಿಲ್ಲೆ', state: 'ರಾಜ್ಯ', crops: 'ನೀವು ಬೆಳೆಯುವ ಬೆಳೆಗಳು', villagePlaceholder: 'ಗ್ರಾಮ ಅಥವಾ ಹತ್ತಿರದ ಊರು', districtPlaceholder: 'ನಿಮ್ಮ ಜಿಲ್ಲೆ', statePlaceholder: 'ನಿಮ್ಮ ರಾಜ್ಯ', cropsPlaceholder: 'ಉದಾಹರಣೆ: ಟೊಮೇಟೊ',
    step: 'ಪ್ರಶ್ನೆ', next: 'ಮುಂದೆ', skip: 'ಬಿಟ್ಟುಬಿಡಿ', back: 'ಹಿಂದೆ', repeatQuestion: 'ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಿ', speakAnswer: 'ಮಾತನಾಡಿ ಉತ್ತರಿಸಿ', stopListening: 'ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ', listening: 'ಆಲಿಸುತ್ತಿದ್ದೇನೆ… ಈಗ ಮಾತನಾಡಿ',
    manualHint: 'ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ ಮಾತನಾಡಿ ಅಥವಾ ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ. ತಿಳಿಯದ ವಿವರಗಳನ್ನು ಬಿಟ್ಟುಬಿಡಬಹುದು.', recognitionUnavailable: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬರವಣಿಗೆ ಲಭ್ಯವಿಲ್ಲ. ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ.', microphoneError: 'ಮೈಕ್ರೊಫೋನ್ ಆರಂಭವಾಗಲಿಲ್ಲ. ಬ್ರೌಸರ್ ಅನುಮತಿ ನೀಡಿ ಅಥವಾ ಉತ್ತರ ಟೈಪ್ ಮಾಡಿ.',
    reviewTitle: 'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ', reviewQuestion: 'ಈ ವಿವರಗಳು ಸರಿಯಾಗಿವೆಯೇ?', notProvided: 'ನೀಡಿಲ್ಲ', changeInfo: 'ವಿವರ ಬದಲಿಸಿ', confirmInfo: 'ವಿವರ ದೃಢೀಕರಿಸಿ', credentialsTitle: 'ಖಾತೆಯ ಸುರಕ್ಷಿತ ವಿವರಗಳು', credentialsHint: 'ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು ಇಲ್ಲಿ ನಮೂದಿಸಿ. ಸಹಾಯಕನಿಗೆ ಪಾಸ್‌ವರ್ಡ್ ಹೇಳಬೇಡಿ ಅಥವಾ ಯಾರೊಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.',
    accountCreate: 'ಸುರಕ್ಷಿತ ಖಾತೆ ತೆರೆಯಿರಿ', confirmation: 'ದೃಢೀಕರಣ ಲಿಂಕ್‌ಗಾಗಿ ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ. ದೃಢೀಕರಿಸಿದ ನಂತರ ಇಲ್ಲಿ ಬಂದು ಲಾಗಿನ್ ಮಾಡಿ.',
    privacy: 'ನಿಮ್ಮ ವಿವರಗಳು ನಿಮ್ಮ ಖಾಸಗಿ ಖಾತೆಯಲ್ಲಿ ಉಳಿಯುತ್ತವೆ.', languageWelcome: 'ಭಾಷೆ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಖಾತೆ ತೆರೆಯಲು ಅಥವಾ ಲಾಗಿನ್ ಮಾಡಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.'
  }
};

const registrationQuestions = {
  en: [
    { key: 'name', prompt: 'What is your name?', required: true },
    { key: 'village', prompt: 'Which village or town do you live in?' },
    { key: 'district', prompt: 'Which district is it in?' },
    { key: 'state', prompt: 'Which state is it in?' },
    { key: 'currentCrops', prompt: 'Which crops do you grow? You can name more than one.' }
  ],
  hi: [
    { key: 'name', prompt: 'आपका नाम क्या है?', required: true },
    { key: 'village', prompt: 'आप किस गाँव या कस्बे में रहते हैं?' },
    { key: 'district', prompt: 'यह किस ज़िले में है?' },
    { key: 'state', prompt: 'यह किस राज्य में है?' },
    { key: 'currentCrops', prompt: 'आप कौन-कौन सी फसलें उगाते हैं? एक से अधिक बता सकते हैं।' }
  ],
  kn: [
    { key: 'name', prompt: 'ನಿಮ್ಮ ಹೆಸರೇನು?', required: true },
    { key: 'village', prompt: 'ನೀವು ಯಾವ ಗ್ರಾಮ ಅಥವಾ ಊರಿನಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?' },
    { key: 'district', prompt: 'ಅದು ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿದೆ?' },
    { key: 'state', prompt: 'ಅದು ಯಾವ ರಾಜ್ಯದಲ್ಲಿದೆ?' },
    { key: 'currentCrops', prompt: 'ನೀವು ಯಾವ ಬೆಳೆಗಳನ್ನು ಬೆಳೆಯುತ್ತೀರಿ? ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಹೇಳಬಹುದು.' }
  ]
};

const serviceCopy = {
  en: {
    greeting: name => `Hello${name ? ` ${name}` : ''}! Welcome to your farming assistant. What help do you need today?`,
    intro: 'I can help with weather, crop choices, crop problems, irrigation, market prices, and government schemes.',
    title: 'Your farming assistant', start: 'Start voice assistant', listenAgain: 'Repeat welcome', stop: 'Stop speaking', talk: 'Talk to Saathi', servicesTitle: 'Choose what you need help with',
    services: {
      weather: ['Weather information', 'Find out whether rain is forecast today or tomorrow.', 'Open weather'],
      crops: ['Choose a crop', 'See crop ideas using the farm details you shared.', 'Crop advice'],
      disease: ['Crop problem', 'Describe symptoms or upload a crop photo for possible causes.', 'Check a crop problem'],
      irrigation: ['Watering advice', 'Get a careful irrigation checklist using known details.', 'Irrigation'],
      markets: ['Market prices', 'Search reported prices from available mandi records.', 'Check prices'],
      schemes: ['Government schemes', 'Browse source-linked scheme records and official application links.', 'Scheme information']
    }
  },
  hi: {
    greeting: name => `नमस्कार${name ? ` ${name} जी` : ''}! आपके कृषि सहायक में स्वागत है। आज आपको किस मदद की ज़रूरत है?`,
    intro: 'मैं मौसम, फसल चुनने, फसल की समस्या, सिंचाई, मंडी भाव और सरकारी योजनाओं में मदद कर सकता हूँ।',
    title: 'आपका कृषि सहायक', start: 'आवाज़ सहायक शुरू करें', listenAgain: 'स्वागत फिर सुनें', stop: 'बोलना बंद करें', talk: 'साथी से बात करें', servicesTitle: 'बताएं, किस चीज़ में मदद चाहिए',
    services: {
      weather: ['मौसम की जानकारी', 'आज या कल बारिश की संभावना जानें।', 'मौसम देखें'],
      crops: ['फसल चुनें', 'आपके खेत की जानकारी के आधार पर फसल के सुझाव देखें।', 'फसल सलाह'],
      disease: ['फसल की समस्या', 'लक्षण बताएं या संभावित कारण जानने के लिए फोटो भेजें।', 'समस्या देखें'],
      irrigation: ['सिंचाई सलाह', 'उपलब्ध जानकारी के आधार पर सिंचाई की जाँच सूची पाएं।', 'सिंचाई'],
      markets: ['मंडी भाव', 'उपलब्ध मंडी रिकॉर्ड में दर्ज भाव खोजें।', 'भाव देखें'],
      schemes: ['सरकारी योजनाएं', 'सत्यापित योजना रिकॉर्ड और आधिकारिक आवेदन लिंक देखें।', 'योजना जानकारी']
    }
  },
  kn: {
    greeting: name => `ನಮಸ್ಕಾರ${name ? ` ${name} ಅವರೇ` : ''}! ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕನಿಗೆ ಸ್ವಾಗತ. ಇಂದು ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?`,
    intro: 'ಹವಾಮಾನ, ಬೆಳೆ ಆಯ್ಕೆ, ಬೆಳೆ ಸಮಸ್ಯೆ, ನೀರಾವರಿ, ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
    title: 'ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ', start: 'ಧ್ವನಿ ಸಹಾಯಕ ಆರಂಭಿಸಿ', listenAgain: 'ಸ್ವಾಗತವನ್ನು ಮತ್ತೆ ಕೇಳಿ', stop: 'ಮಾತು ನಿಲ್ಲಿಸಿ', talk: 'ಸಾಥಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ', servicesTitle: 'ಯಾವ ಸಹಾಯ ಬೇಕು ಎಂದು ಆಯ್ಕೆಮಾಡಿ',
    services: {
      weather: ['ಹವಾಮಾನ ಮಾಹಿತಿ', 'ಇಂದು ಅಥವಾ ನಾಳೆ ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇದೆಯೇ ತಿಳಿಯಿರಿ.', 'ಹವಾಮಾನ ನೋಡಿ'],
      crops: ['ಬೆಳೆ ಆಯ್ಕೆ', 'ನೀವು ನೀಡಿದ ಹೊಲದ ವಿವರಗಳ ಆಧಾರದ ಮೇಲೆ ಬೆಳೆ ಸಲಹೆ ನೋಡಿ.', 'ಬೆಳೆ ಸಲಹೆ'],
      disease: ['ಬೆಳೆ ಸಮಸ್ಯೆ', 'ಲಕ್ಷಣ ವಿವರಿಸಿ ಅಥವಾ ಸಾಧ್ಯ ಕಾರಣ ತಿಳಿಯಲು ಬೆಳೆ ಫೋಟೋ ಕಳುಹಿಸಿ.', 'ಬೆಳೆ ಸಮಸ್ಯೆ ನೋಡಿ'],
      irrigation: ['ನೀರಾವರಿ ಸಲಹೆ', 'ಲಭ್ಯವಿರುವ ವಿವರಗಳ ಆಧಾರದ ಮೇಲೆ ನೀರಾವರಿ ಪರಿಶೀಲನಾ ಪಟ್ಟಿ ಪಡೆಯಿರಿ.', 'ನೀರಾವರಿ'],
      markets: ['ಮಾರುಕಟ್ಟೆ ಬೆಲೆ', 'ಲಭ್ಯವಿರುವ ಮಂಡಿ ದಾಖಲೆಗಳಲ್ಲಿನ ವರದಿಯಾದ ಬೆಲೆ ಹುಡುಕಿ.', 'ಬೆಲೆ ನೋಡಿ'],
      schemes: ['ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು', 'ಪರಿಶೀಲಿಸಿದ ಯೋಜನೆ ಮಾಹಿತಿ ಮತ್ತು ಅಧಿಕೃತ ಅರ್ಜಿ ಲಿಂಕ್‌ಗಳನ್ನು ನೋಡಿ.', 'ಯೋಜನೆ ಮಾಹಿತಿ']
    }
  }
};

const assistantCopy = {
  en: {
    eyebrow: 'FARMING ASSISTANT', title: 'Talk to Saathi', description: 'Ask naturally in your language. Tap the microphone, review what it heard, then send.',
    greeting: 'How can I help you today?', composer: 'Speak or type a farming question…', send: 'Send question', microphone: 'Start listening', stopListening: 'Stop listening', listening: 'Listening… speak now',
    listen: 'Listen', stopSpeaking: 'Stop speaking', newConversation: 'New conversation', home: 'Home', ready: 'Ready to help',
    voiceUnsupported: 'Voice input is not available in this browser. Type your question instead.', voiceError: 'Microphone did not start. Check browser permission, or type your question.', voiceMissing: 'No speech voice for this language is available on this device. The answer remains visible as text.',
    reviewSpeech: 'I heard you. Review the words, then send.', retry: 'Try microphone again',
    askLocation: 'Which village or town should I use? I will show it for confirmation before saving.', confirmLocation: location => `Should I save “${location}” as your village or town?`, confirm: 'Confirm and save', change: 'Change location', saved: location => `I saved ${location} as your village. I’ll check your request now.`, cancel: 'Location was not saved. You can tell me a location whenever you are ready.'
  },
  hi: {
    eyebrow: 'कृषि सहायक', title: 'साथी से बात करें', description: 'अपनी भाषा में सवाल पूछें। माइक्रोफ़ोन दबाएं, सुने गए शब्द जाँचें, फिर भेजें।',
    greeting: 'आज मैं आपकी क्या मदद करूँ?', composer: 'खेती का सवाल बोलें या लिखें…', send: 'सवाल भेजें', microphone: 'सुनना शुरू करें', stopListening: 'सुनना बंद करें', listening: 'सुन रहा हूँ… अब बोलें',
    listen: 'सुनें', stopSpeaking: 'बोलना बंद करें', newConversation: 'नई बातचीत', home: 'मुख्य पृष्ठ', ready: 'मदद के लिए तैयार',
    voiceUnsupported: 'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। सवाल टाइप करें।', voiceError: 'माइक्रोफ़ोन शुरू नहीं हुआ। ब्राउज़र की अनुमति जाँचें या सवाल टाइप करें।', voiceMissing: 'इस डिवाइस में इस भाषा की आवाज़ उपलब्ध नहीं है। जवाब टेक्स्ट में दिखेगा।',
    reviewSpeech: 'आपकी बात लिख ली गई है। पढ़कर देखें, फिर भेजें।', retry: 'माइक्रोफ़ोन फिर आज़माएं',
    askLocation: 'मैं किस गाँव या कस्बे का उपयोग करूँ? सहेजने से पहले पुष्टि करूँगा।', confirmLocation: location => `क्या मैं “${location}” को आपका गाँव या कस्बा सहेजूँ?`, confirm: 'पुष्टि करें और सहेजें', change: 'जगह बदलें', saved: location => `मैंने ${location} को आपके गाँव के रूप में सहेजा। अब आपके सवाल की जाँच करता हूँ।`, cancel: 'जगह नहीं सहेजी गई। तैयार होने पर बता सकते हैं।'
  },
  kn: {
    eyebrow: 'ಕೃಷಿ ಸಹಾಯಕ', title: 'ಸಾಥಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ', description: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಸಹಜವಾಗಿ ಕೇಳಿ. ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ, ಕೇಳಿದ ಪದಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ನಂತರ ಕಳುಹಿಸಿ.',
    greeting: 'ಇಂದು ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?', composer: 'ಕೃಷಿ ಪ್ರಶ್ನೆ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ…', send: 'ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ', microphone: 'ಆಲಿಸಲು ಆರಂಭಿಸಿ', stopListening: 'ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ', listening: 'ಆಲಿಸುತ್ತಿದ್ದೇನೆ… ಈಗ ಮಾತನಾಡಿ',
    listen: 'ಕೇಳಿ', stopSpeaking: 'ಮಾತು ನಿಲ್ಲಿಸಿ', newConversation: 'ಹೊಸ ಸಂಭಾಷಣೆ', home: 'ಮುಖ್ಯ ಪುಟ', ready: 'ಸಹಾಯಕ್ಕೆ ಸಿದ್ಧ',
    voiceUnsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬರವಣಿಗೆ ಲಭ್ಯವಿಲ್ಲ. ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.', voiceError: 'ಮೈಕ್ರೊಫೋನ್ ಆರಂಭವಾಗಲಿಲ್ಲ. ಬ್ರೌಸರ್ ಅನುಮತಿ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ.', voiceMissing: 'ಈ ಸಾಧನದಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ಉತ್ತರ ಪಠ್ಯವಾಗಿ ಕಾಣಿಸುತ್ತದೆ.',
    reviewSpeech: 'ನಿಮ್ಮ ಮಾತು ಬರೆಯಲಾಗಿದೆ. ಪರಿಶೀಲಿಸಿ ನಂತರ ಕಳುಹಿಸಿ.', retry: 'ಮೈಕ್ರೊಫೋನ್ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    askLocation: 'ಯಾವ ಗ್ರಾಮ ಅಥವಾ ಊರನ್ನು ಬಳಸಲಿ? ಉಳಿಸುವ ಮೊದಲು ನಿಮ್ಮ ದೃಢೀಕರಣ ಕೇಳುತ್ತೇನೆ.', confirmLocation: location => `“${location}” ಅನ್ನು ನಿಮ್ಮ ಗ್ರಾಮ ಅಥವಾ ಊರಾಗಿ ಉಳಿಸಬೇಕೇ?`, confirm: 'ದೃಢೀಕರಿಸಿ ಮತ್ತು ಉಳಿಸಿ', change: 'ಸ್ಥಳ ಬದಲಿಸಿ', saved: location => `${location} ಅನ್ನು ನಿಮ್ಮ ಗ್ರಾಮವಾಗಿ ಉಳಿಸಿದ್ದೇನೆ. ಈಗ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ.`, cancel: 'ಸ್ಥಳವನ್ನು ಉಳಿಸಿಲ್ಲ. ಸಿದ್ಧರಾದಾಗ ಹೇಳಬಹುದು.'
  }
};

const languageStorageKey = 'farmer-saathi-language';
const supportedLanguages = new Set(['en', 'hi', 'kn']);

function readSavedLanguage() {
  try {
    const language = window.localStorage.getItem(languageStorageKey);
    return supportedLanguages.has(language) ? language : null;
  } catch { return null; }
}

function saveLanguage(language) {
  try { window.localStorage.setItem(languageStorageKey, language); } catch { /* Storage can be disabled in private browser modes. */ }
}

const nav = [
  { to: '/dashboard', key: 'overview', icon: House }, { to: '/weather', key: 'weather', icon: Cloud },
  { to: '/markets', key: 'markets', icon: BadgeIndianRupee }, { to: '/crops', key: 'crops', icon: Sprout },
  { to: '/assistant', key: 'assistant', icon: MessageCircle }, { to: '/irrigation', key: 'irrigation', icon: Droplets },
  { to: '/disease', key: 'disease', icon: Activity }, { to: '/profile', key: 'profile', icon: UserRound }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [farmer, setFarmer] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setChecking(false); }
    }).catch(() => { if (active) setChecking(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.access_token) { setFarmer(null); setChecking(false); return; }
    let active = true;
    setChecking(true); setProfileError('');
    api.get('/farmers/profile').then(({ data }) => { if (active) setFarmer(data.farmer); })
      .catch(async error => {
        if (!active) return;
        if (error.response?.status === 401) await supabase?.auth.signOut();
        else setProfileError(errorMessage(error));
      }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (farmer?.preferredLanguage && supportedLanguages.has(farmer.preferredLanguage)) saveLanguage(farmer.preferredLanguage);
  }, [farmer?.preferredLanguage]);

  const onAuthenticated = (nextSession) => {
    setSession(nextSession);
    setFarmer(null);
    setProfileError('');
  };
  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); setFarmer(null); };

  if (checking) return <div className="full-loading"><LoaderCircle className="spin" /><span>Opening your farm…</span></div>;
  if (!session) return <AuthPage onAuthenticated={onAuthenticated} />;
  if (profileError && !farmer) return <div className="error-screen"><ShieldCheck size={30} /><h1>Could not load your profile</h1><p>{profileError}</p><button className="primary-button" onClick={signOut}>Sign in again</button></div>;
  if (!farmer) return <div className="full-loading"><LoaderCircle className="spin" /><span>Loading your profile…</span></div>;

  return <Routes>
    <Route element={<AppShell farmer={farmer} setFarmer={setFarmer} onSignOut={signOut} />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="weather" element={<WeatherPage />} />
      <Route path="markets" element={<MarketsPage />} />
      <Route path="crops" element={<CropsPage />} />
      <Route path="assistant" element={<AssistantPage />} />
      <Route path="irrigation" element={<IrrigationPage />} />
      <Route path="disease" element={<DiseasePage />} />
      <Route path="schemes" element={<SchemesPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}

function AuthPage({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [mode, setMode] = useState('simple');
  const [guidedStage, setGuidedStage] = useState('steps');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepValue, setStepValue] = useState('');
  const savedLanguage = readSavedLanguage();
  const [language, setLanguage] = useState(savedLanguage || getBrowserHelpLanguage());
  const [showLanguageChoice, setShowLanguageChoice] = useState(!savedLanguage);
  const [form, setForm] = useState({ name: '', email: '', password: '', village: '', district: '', state: '', currentCrops: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const recognitionRef = useRef(null);
  const copy = authCopy[language];
  const questions = registrationQuestions[language];
  const currentQuestion = questions[stepIndex];

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  function updateLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }

  async function confirmLanguage() {
    saveLanguage(language);
    setShowLanguageChoice(false);
    await speakText(authCopy[language].languageWelcome, language);
  }

  function setFormValue(key, value) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function startGuidedSetup() {
    setMode('guided');
    setGuidedStage('steps');
    setStepIndex(0);
    setStepValue(form.name);
    setError('');
    setNotice('');
  }

  function goToQuestion(index) {
    const target = Math.max(0, Math.min(index, questions.length - 1));
    setStepIndex(target);
    setStepValue(form[questions[target].key] || '');
    setSpeechNotice('');
    setGuidedStage('steps');
  }

  function moveQuestion(skip = false) {
    const question = questions[stepIndex];
    const value = skip ? '' : stepValue.trim();
    if (question.required && !value) {
      setSpeechNotice(language === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ಹೇಳಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.' : language === 'hi' ? 'कृपया अपना नाम बोलें या लिखें।' : 'Please say or type your name.');
      return;
    }
    const nextForm = { ...form, [question.key]: value };
    setForm(nextForm);
    setSpeechNotice('');
    if (stepIndex === questions.length - 1) {
      setGuidedStage('review');
    } else {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setStepValue(nextForm[questions[nextIndex].key] || '');
    }
  }

  function startListening() {
    const recognition = createSpeechRecognition(language);
    if (!recognition) { setSpeechNotice(copy.recognitionUnavailable); return; }
    try {
      recognitionRef.current = recognition;
      recognition.onstart = () => { setListening(true); setSpeechNotice(''); };
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setListening(false); setSpeechNotice(copy.microphoneError); };
      recognition.onresult = event => setStepValue(event.results?.[0]?.[0]?.transcript || '');
      recognition.start();
    } catch { setListening(false); setSpeechNotice(copy.microphoneError); }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function repeatQuestion() {
    const result = await speakText(currentQuestion.prompt, language);
    if (!result.ok && result.reason !== 'cancelled') {
      setSpeechNotice(result.reason === 'unsupported' ? authHelpContent[language].speechUnsupported : authHelpContent[language].voiceMissing);
    }
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!supabase) throw new Error('Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local.');
      const profileMetadata = {
        name: form.name.trim(), preferredLanguage: language,
        village: form.village.trim(), district: form.district.trim(), state: form.state.trim(),
        currentCrops: splitList(form.currentCrops)
      };
      const result = register
        ? await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: profileMetadata } })
        : await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      if (result.error) throw result.error;
      if (register && !result.data.session) {
        setNotice(copy.confirmation);
      } else if (result.data.session) {
        setNotice('');
        onAuthenticated(result.data.session);
      } else {
        throw new Error('Supabase did not return a signed-in session. Try signing in again.');
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  const onAuthLanguageChange = nextLanguage => {
    updateLanguage(nextLanguage);
    setShowLanguageChoice(false);
  };

  return <main className="auth-page">
    <section className="auth-story">
      <div className="brand brand-light"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></div>
      <div className="auth-story-copy"><span className="eyebrow light-eyebrow"><span className="live-dot" />{language === 'kn' ? 'ಪ್ರತಿ ಬೆಳೆಯ ಋತುವಿಗೂ ಸಹಾಯ' : language === 'hi' ? 'हर फसल के मौसम में साथ' : 'A little help for every growing season'}</span>
        <h1>{language === 'kn' ? <>ಒಳ್ಳೆಯ ನಿರ್ಧಾರಗಳು<br />ಇಲ್ಲಿಂದ ಬೆಳೆಯುತ್ತವೆ.</> : language === 'hi' ? <>अच्छे फैसले<br />यहीं से बढ़ते हैं।</> : <>Good decisions<br />grow from here.</>}</h1>
        <p>{language === 'kn' ? 'ಹವಾಮಾನ, ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಮತ್ತು ಕೃಷಿ ಸಲಹೆ ಒಂದೇ ಕಡೆ.' : language === 'hi' ? 'मौसम, बाज़ार की जानकारी और खेती की सलाह एक ही जगह।' : 'Weather, market information and practical crop guidance, together in one place.'}</p>
      </div>
      <div className="story-note"><Sprout size={18} /><span>{language === 'kn' ? 'ನಮ್ಮ ಆಹಾರ ಬೆಳೆಸುವ ರೈತರಿಗಾಗಿ.' : language === 'hi' ? 'हमारा भोजन उगाने वाले किसानों के लिए।' : 'Made for the people who grow our food.'}</span></div>
      <span className="story-decoration story-decoration-one" /><span className="story-decoration story-decoration-two" />
    </section>
    <section className="auth-form-wrap"><div className="auth-form-stack">
      {showLanguageChoice ? <div className="auth-form-card language-choice-card">
        <span className="eyebrow">FARMER SAATHI</span><h2>{authCopy[language].languageTitle}</h2><p className="muted">{authCopy[language].languageDescription}</p>
        <div className="language-choice-list">{[['kn', 'ಕನ್ನಡ'], ['hi', 'हिन्दी'], ['en', 'English']].map(([code, label]) => <button type="button" key={code} className={`language-choice ${language === code ? 'language-choice-selected' : ''}`} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>)}</div>
        <button className="primary-button auth-submit" onClick={confirmLanguage} type="button">{copy.continue}<ArrowRight size={18} /></button>
      </div> : <>
        <div className="auth-form-card">
          <div className="auth-card-topline"><span className="eyebrow">{language === 'kn' ? 'ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ' : language === 'hi' ? 'आपका कृषि सहायक' : 'YOUR FARMING COMPANION'}</span><button className="auth-language-change" type="button" onClick={() => setShowLanguageChoice(true)}><Globe2 size={14} />{copy.changeLanguage}</button></div>
          <h2>{register ? copy.registerTitle : copy.loginTitle}</h2>
          <p className="muted">{register ? copy.registerDescription : copy.loginDescription}</p>
          {register && <div className="auth-mode-switch"><button type="button" className={mode === 'simple' ? 'auth-mode-active' : ''} onClick={() => { setMode('simple'); setError(''); }}>{copy.visualMode}</button><button type="button" className={mode === 'guided' ? 'auth-mode-active' : ''} onClick={startGuidedSetup}>{copy.voiceMode}</button></div>}

          {!register || mode === 'simple' ? <form onSubmit={submit} className="form-stack">
            {register && <Field label={copy.name} placeholder={copy.namePlaceholder} autoComplete="name" value={form.name} onChange={name => setFormValue('name', name)} required />}
            <Field label={copy.email} type="email" placeholder={copy.emailPlaceholder} autoComplete="email" value={form.email} onChange={email => setFormValue('email', email)} required />
            <Field label={copy.password} type="password" placeholder={register ? copy.passwordPlaceholder : copy.password} autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={password => setFormValue('password', password)} required minLength={register ? 8 : 1} />
            {register && <>
              <div className="field-grid"><Field label={`${copy.village} (${copy.optional})`} placeholder={copy.villagePlaceholder} value={form.village} onChange={village => setFormValue('village', village)} /><Field label={`${copy.district} (${copy.optional})`} placeholder={copy.districtPlaceholder} value={form.district} onChange={district => setFormValue('district', district)} /></div>
              <div className="field-grid"><Field label={`${copy.state} (${copy.optional})`} placeholder={copy.statePlaceholder} value={form.state} onChange={state => setFormValue('state', state)} /><Field label={`${copy.crops} (${copy.optional})`} placeholder={copy.cropsPlaceholder} value={form.currentCrops} onChange={currentCrops => setFormValue('currentCrops', currentCrops)} /></div>
            </>}
            {register && <p className="field-hint">{copy.credentialsHint}</p>}
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            {notice && <div className="alert alert-success" role="status"><ShieldCheck size={17} />{notice}</div>}
            <button disabled={busy} className="primary-button auth-submit">{busy ? <LoaderCircle className="spin" size={18} /> : null}{register ? copy.createAccount : copy.signIn}<ArrowRight size={18} /></button>
          </form> : guidedStage === 'steps' ? <form onSubmit={event => { event.preventDefault(); moveQuestion(); }} className="form-stack guided-registration">
            <div className="guided-step-count">{copy.step} {stepIndex + 1} / {questions.length}</div>
            <h3 className="guided-question">{currentQuestion.prompt}</h3>
            <p className="field-hint">{copy.manualHint}</p>
            <div className="guided-voice-actions">
              <button type="button" className="subtle-button" onClick={repeatQuestion}><Volume2 size={17} />{copy.repeatQuestion}</button>
              <button type="button" className={`guided-mic ${listening ? 'mic-listening' : ''}`} onClick={listening ? stopListening : startListening} aria-label={listening ? copy.stopListening : copy.speakAnswer}>{listening ? <MicOff size={21} /> : <Mic size={21} />}{listening ? copy.stopListening : copy.speakAnswer}</button>
            </div>
            <Field label={currentQuestion.key === 'currentCrops' ? copy.crops : copy[currentQuestion.key]} placeholder={currentQuestion.key === 'currentCrops' ? copy.crops : copy[currentQuestion.key]} value={stepValue} onChange={setStepValue} autoComplete={currentQuestion.key === 'name' ? 'name' : 'off'} />
            {listening && <p className="guided-status" role="status">{copy.listening}</p>}
            {speechNotice && <p className="auth-help-notice" role="status">{speechNotice}</p>}
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" disabled={stepIndex === 0} onClick={() => goToQuestion(stepIndex - 1)}><ChevronLeft size={16} />{copy.back}</button><div>{!currentQuestion.required && <button className="text-link" type="button" onClick={() => moveQuestion(true)}>{copy.skip}</button>}<button className="primary-button" type="submit">{copy.next}<ArrowRight size={17} /></button></div></div>
          </form> : guidedStage === 'review' ? <div className="form-stack guided-registration">
            <div className="guided-step-count">{copy.reviewTitle}</div><h3 className="guided-question">{copy.reviewQuestion}</h3>
            <dl className="registration-summary">{questions.map(question => <div key={question.key}><dt>{question.key === 'currentCrops' ? copy.crops : copy[question.key]}</dt><dd>{form[question.key]?.trim() || copy.notProvided}</dd></div>)}</dl>
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" onClick={() => goToQuestion(0)}>{copy.changeInfo}</button><button className="primary-button" type="button" onClick={() => setGuidedStage('credentials')}><Check size={17} />{copy.confirmInfo}</button></div>
          </div> : <form onSubmit={submit} className="form-stack guided-registration">
            <div className="guided-step-count">{copy.credentialsTitle}</div><h3 className="guided-question">{form.name}</h3><p className="field-hint">{copy.credentialsHint}</p>
            <Field label={copy.email} type="email" placeholder={copy.emailPlaceholder} autoComplete="email" value={form.email} onChange={email => setFormValue('email', email)} required />
            <Field label={copy.password} type="password" placeholder={copy.passwordPlaceholder} autoComplete="new-password" value={form.password} onChange={password => setFormValue('password', password)} required minLength={8} />
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            {notice && <div className="alert alert-success" role="status"><ShieldCheck size={17} />{notice}</div>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" onClick={() => setGuidedStage('review')}><ChevronLeft size={16} />{copy.back}</button><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{copy.accountCreate}<ArrowRight size={17} /></button></div>
          </form>}

          <p className="switch-auth">{register ? copy.switchToLogin : copy.switchToRegister} <button onClick={() => { setRegister(!register); setMode('simple'); setGuidedStage('steps'); setError(''); setNotice(''); setSpeechNotice(''); }} type="button">{register ? copy.useSignIn : copy.useRegister}</button></p>
          <p className="privacy-note"><ShieldCheck size={15} />{copy.privacy}</p>
        </div>
        <AuthHelp initialLanguage={language} onLanguageChange={onAuthLanguageChange} />
      </>}
    </div></section>
  </main>;
}

function getAuthHelpTopic(question) {
  const text = question.toLocaleLowerCase();
  if (/forgot|reset|password|पासवर्ड|मरेत|ಪಾಸ್.?ವರ್ಡ್|ಮರೆತ/.test(text)) return 'password';
  if (/register|sign.?up|create account|new account|रजिस्टर|खाता|पंजीकरण|ನೋಂದಣಿ|ಖಾತೆ/.test(text)) return 'register';
  if (/email|confirm|verification|ईमेल|पुष्टि|ದೃಢೀಕರಣ|ಇಮೇಲ್/.test(text)) return 'email';
  if (/log.?in|sign.?in|login|लॉग.?इन|साइन.?इन|ಲಾಗಿನ್|ಲಾಗ್.?ಇನ್|ಸೈನ್.?ಇನ್/.test(text)) return 'login';
  return 'other';
}

function detectAuthHelpLanguage(text) {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return null;
}

function getBrowserHelpLanguage() {
  const browserLanguage = (typeof navigator === 'undefined' ? 'en' : navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  return browserLanguage.startsWith('kn') ? 'kn' : browserLanguage.startsWith('hi') ? 'hi' : 'en';
}

function AuthHelp({ initialLanguage, onLanguageChange = () => {} }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(initialLanguage || getBrowserHelpLanguage());
  const [messages, setMessages] = useState(() => [{ role: 'assistant', text: authHelpContent[initialLanguage || getBrowserHelpLanguage()].greeting }]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const recognitionRef = useRef(null);
  const messageListRef = useRef(null);
  const copy = authHelpContent[language];

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  function changeLanguage(nextLanguage) {
    recognitionRef.current?.abort();
    stopSpeaking();
    setListening(false);
    setLanguage(nextLanguage);
    onLanguageChange(nextLanguage);
    setMessages([{ role: 'assistant', text: authHelpContent[nextLanguage].greeting }]);
    setInput('');
    setSpeechNotice('');
  }

  function answerQuestion(question, knownTopic) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    const answerLanguage = detectAuthHelpLanguage(cleanQuestion) || language;
    const topic = knownTopic || getAuthHelpTopic(cleanQuestion);
    setLanguage(answerLanguage);
    if (answerLanguage !== language) onLanguageChange(answerLanguage);
    setMessages(previous => [
      ...previous,
      { role: 'user', text: cleanQuestion },
      { role: 'assistant', text: authHelpContent[answerLanguage].answers[topic] }
    ]);
    setInput('');
    setSpeechNotice('');
  }

  function submitQuestion(event) {
    event.preventDefault();
    answerQuestion(input);
  }

  function startListening() {
    const recognition = createSpeechRecognition(language);
    if (!recognition) { setSpeechNotice(copy.voiceUnsupported); return; }
    try {
      recognitionRef.current = recognition;
      recognition.onstart = () => { setListening(true); setSpeechNotice(''); };
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setListening(false); setSpeechNotice(copy.voiceError); };
      recognition.onresult = event => {
        setInput(event.results?.[0]?.[0]?.transcript || '');
        setSpeechNotice(copy.speechReview);
      };
      recognition.start();
    } catch {
      setListening(false);
      setSpeechNotice(copy.voiceError);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function speak(text) {
    const result = await speakText(text, language);
    if (result.ok || result.reason === 'cancelled') { setSpeechNotice(''); return; }
    setSpeechNotice(result.reason === 'unsupported' ? copy.speechUnsupported : copy.voiceMissing);
  }

  function toggleHelp() {
    if (open) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setListening(false);
      stopSpeaking();
    }
    setOpen(value => !value);
  }

  return <section className={`auth-help ${open ? 'auth-help-open' : ''}`} aria-label="Sign in and registration help">
    <button className="auth-help-toggle" type="button" aria-expanded={open} onClick={toggleHelp}>
      <span className="auth-help-icon"><MessageCircle size={17} /></span>
      <span className="auth-help-toggle-copy"><b>{authHelpContent[language].title}</b><small>{authHelpContent[language].subtitle}</small></span>
      <ChevronDown className={open ? 'auth-help-chevron-open' : ''} size={17} />
    </button>
    {open && <div className="auth-help-panel">
      <div className="auth-help-tools">
        <span className="auth-help-status"><span className="status-dot" />Saathi</span>
        <label className="auth-help-language"><span className="sr-only">{copy.language}</span><select value={language} onChange={event => changeLanguage(event.target.value)} aria-label={copy.language}><option value="en">English</option><option value="hi">हिन्दी</option><option value="kn">ಕನ್ನಡ</option></select><Globe2 size={14} /></label>
      </div>
      <div className="auth-help-messages" ref={messageListRef} role="log" aria-live="polite" aria-label="Saathi conversation">
        {messages.map((message, index) => <div className={`auth-help-message ${message.role === 'user' ? 'auth-help-user' : ''}`} key={`${index}-${message.role}`}>
          <div className="auth-help-bubble">{message.text}</div>
          {message.role === 'assistant' && <button className="auth-help-listen" type="button" onClick={() => speak(message.text)}><Volume2 size={14} />{copy.listen}</button>}
        </div>)}
      </div>
      <div className="auth-help-prompts" aria-label="Common account questions">
        {copy.prompts.map(([topic, label]) => <button type="button" key={topic} onClick={() => answerQuestion(label, topic)}>{label}</button>)}
      </div>
      {speechNotice && <p className="auth-help-notice" role="status">{speechNotice}</p>}
      <form className="auth-help-composer" onSubmit={submitQuestion}>
        <button className={`auth-help-mic ${listening ? 'mic-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? copy.stopVoice : copy.voice} title={listening ? copy.stopVoice : copy.voice}>{listening ? <MicOff size={17} /> : <Mic size={17} />}</button>
        <input value={input} onChange={event => {
          const value = event.target.value;
          setInput(value);
          const detectedLanguage = detectAuthHelpLanguage(value);
          if (detectedLanguage) {
            setLanguage(detectedLanguage);
            onLanguageChange(detectedLanguage);
          }
        }} placeholder={copy.placeholder} aria-label={copy.placeholder} />
        <button className="auth-help-send" type="submit" disabled={!input.trim()} aria-label={copy.send}><Send size={16} /></button>
      </form>
      <p className="auth-help-voice-hint">{copy.voiceLanguageHint}</p>
      <p className="auth-help-privacy"><ShieldCheck size={14} />{copy.privacy}</p>
    </div>}
  </section>;
}

function Field({ label, value, onChange, type = 'text', ...props }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} {...props} /></label>;
}

function AppShell({ farmer, setFarmer, onSignOut }) {
  const [mobileNav, setMobileNav] = useState(false);
  const t = words[farmer?.preferredLanguage] || words.en;
  const location = useLocation();
  const page = nav.find(item => item.to === location.pathname);
  const initials = farmer?.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'F';

  async function changeLanguage(value) {
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, { preferredLanguage: value });
      setFarmer(data.farmer);
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
        <div className="topbar-right"><label className="language-control"><Globe2 size={16} /><span className="sr-only">{t.language}</span><select aria-label={t.language} value={farmer?.preferredLanguage || 'en'} onChange={e => changeLanguage(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="kn">ಕನ್ನಡ</option></select><ChevronDown size={13} /></label><span className="topbar-divider" /><div className="user-chip"><span className="avatar">{initials}</span><span className="user-name">{farmer?.name?.split(' ')[0]}</span></div></div>
      </header>
      <div className="page-content"><Outlet context={{ farmer, setFarmer }} /></div>
    </main>
  </div>;
}

function useFarm() { return useOutletContext(); }
function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
function Card({ className = '', children }) { return <section className={`card ${className}`}>{children}</section>; }
function ErrorNotice({ children, retry }) { return <div className="alert alert-error"><FileWarning size={17} /><span>{children}</span>{retry && <button onClick={retry}>Try again</button>}</div>; }
function LoadingBox({ label = 'Getting the latest information…' }) { return <div className="loading-box"><LoaderCircle className="spin" size={21} /><span>{label}</span></div>; }
function MetaLine({ source, time }) { const attribution = source === 'Open-Meteo' ? <>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, adapted under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>; location data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>.</> : source || 'Source provided by data service'; return <div className="data-meta"><span><ShieldCheck size={13} /> {attribution}</span><span>{time ? `Updated ${new Date(time).toLocaleString()}` : 'Forecast date shown on each day'}</span></div>; }
function useRequest(path, dependencies = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try { const { data } = await api.get(path); setState({ data, error: '', loading: false }); }
    catch (error) { setState({ data: null, error: errorMessage(error), loading: false }); }
  };
  useEffect(() => { load(); }, dependencies);
  return { ...state, load };
}

function VoiceWelcome({ farmer }) {
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = serviceCopy[language];
  const [speechNotice, setSpeechNotice] = useState('');
  const firstName = farmer?.name?.split(' ')[0] || '';
  const serviceLinks = [
    ['weather', '/weather', Cloud], ['crops', '/crops', Sprout], ['disease', '/disease', Leaf],
    ['irrigation', '/irrigation', Droplets], ['markets', '/markets', BadgeIndianRupee], ['schemes', '/schemes', Landmark]
  ];

  async function readWelcome() {
    const response = await speakText(`${copy.greeting(firstName)} ${copy.intro}`, language);
    if (response.ok || response.reason === 'cancelled') setSpeechNotice('');
    else setSpeechNotice(response.reason === 'unsupported' ? authHelpContent[language].speechUnsupported : authHelpContent[language].voiceMissing);
  }

  return <Card className="voice-welcome-card">
    <div className="voice-welcome-head"><span className="assistant-avatar"><Leaf size={19} /></span><div><span className="eyebrow">{copy.title}</span><h2>{copy.greeting(firstName)}</h2><p>{copy.intro}</p></div></div>
    <div className="voice-welcome-actions"><button className="primary-button voice-start-button" type="button" onClick={readWelcome}><Volume2 size={19} />{copy.start}</button><button className="subtle-button voice-stop-button" type="button" onClick={stopSpeaking}><VolumeX size={17} />{copy.stop}</button><Link className="subtle-button voice-chat-link" to="/assistant"><Mic size={18} />{copy.talk}</Link></div>
    {speechNotice && <p className="voice-welcome-notice" role="status">{speechNotice}</p>}
    <h3 className="voice-services-title">{copy.servicesTitle}</h3>
    <div className="voice-service-grid">{serviceLinks.map(([key, to, Icon]) => {
      const [title, description, action] = copy.services[key];
      return <Link className="voice-service-card" to={to} key={key}><span className="feature-icon"><Icon size={20} /></span><b>{title}</b><span>{description}</span><strong>{action}<ArrowRight size={15} /></strong></Link>;
    })}</div>
  </Card>;
}

function Dashboard() {
  const { farmer } = useFarm();
  const t = words[farmer?.preferredLanguage] || words.en;
  const weather = useRequest('/weather');
  const market = useRequest(`/mandi/prices?state=${encodeURIComponent(farmer?.state || '')}&district=${encodeURIComponent(farmer?.district || '')}`);
  const locationName = [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ');
  const firstName = farmer?.name?.split(' ')[0] || '';
  return <>
    <div className="welcome-band"><div className="welcome-copy"><span className="eyebrow light-eyebrow">{t.welcome}, {firstName}</span><h1>{t.dashboard}</h1><p>A clearer view of the day, with useful guidance for what comes next.</p><div className="welcome-location"><MapPin size={15} />{locationName || <Link to="/profile">{t.location} <ArrowRight size={14} /></Link>}</div></div><div className="welcome-art"><div className="sun-disc"><Sun size={33} /></div><div className="hill hill-back" /><div className="hill hill-front" /><div className="art-leaf art-leaf-one"><Leaf /></div><div className="art-leaf art-leaf-two"><Leaf /></div></div></div>
    <VoiceWelcome farmer={farmer} />
    <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Your daily picture</h2></div><span className="date-stamp"><CalendarDays size={16} />{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div className="dashboard-grid">
      <Card className="weather-summary"><div className="card-head"><div><span className="eyebrow">{t.forecast.toUpperCase()}</span><h3>Weather outlook</h3></div><Link className="icon-link" to="/weather" aria-label="Open weather"><ArrowRight size={18} /></Link></div>
        {weather.loading ? <LoadingBox label="Checking forecast…" /> : weather.error ? <div className="empty-block"><Cloud size={25} /><p>{weather.error}</p><Link to="/weather">Open weather <ArrowRight size={14} /></Link></div> : <><div className="current-weather"><div className="weather-symbol"><WeatherIcon conditions={weather.data.current.conditions} size={27} /></div><div><strong>{Math.round(weather.data.current.temperatureC)}°</strong><span>{weather.data.current.conditions}</span></div><div className="weather-place"><MapPin size={14} />{weather.data.location}</div></div><div className="weather-metrics"><Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} /><Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} /><Metric icon={CloudRain} label="Rain now" value={`${weather.data.current.rainfallMm} mm`} /></div><MetaLine source={weather.data.source} time={weather.data.fetchedAt} /></>}
      </Card>
      <Card className="market-summary"><div className="card-head"><div><span className="eyebrow">LOCAL MARKETS</span><h3>Reported mandi prices</h3></div><Link className="icon-link" to="/markets" aria-label="Open mandi prices"><ArrowRight size={18} /></Link></div>
        {market.loading ? <LoadingBox label="Checking market data…" /> : market.error ? <div className="empty-block"><BadgeIndianRupee size={25} /><p>{market.error}</p><Link to="/markets">Search mandi prices <ArrowRight size={14} /></Link></div> : market.data.records.length ? <><div className="price-list">{market.data.records.slice(0, 4).map((row, i) => <PriceRow key={`${row.market}-${row.commodity}-${i}`} row={row} />)}</div><MetaLine source={market.data.source} time={market.data.fetchedAt} /></> : <div className="empty-block"><BadgeIndianRupee size={25} /><p>No records matched your saved location. Search another district or crop.</p><Link to="/markets">Search market prices <ArrowRight size={14} /></Link></div>}
      </Card>
      <Card className="feature-card crop-feature"><div className="feature-top"><span className="feature-icon"><Sprout size={20} /></span><span className="pill">PERSONALIZED</span></div><div><h3>Which crop fits your farm?</h3><p>Get ideas based on the details you’ve shared, with missing information called out.</p><Link className="text-link" to="/crops">Explore crop advice <ArrowRight size={16} /></Link></div></Card>
      <Card className="feature-card ask-feature"><div className="feature-top"><span className="feature-icon"><MessageCircle size={20} /></span><span className="pill pill-soft">HERE TO HELP</span></div><div><h3>A question came up?</h3><p>Ask in your preferred language about crops, weather, soil or farm care.</p><Link className="text-link" to="/assistant">Ask Saathi <ArrowRight size={16} /></Link></div></Card>
      <Card className="tip-card"><div className="tip-icon"><ShieldCheck size={20} /></div><div><span className="eyebrow">A NOTE ON ADVICE</span><p>Weather and market information shows its source and date. AI suggestions are guidance, not a confirmed diagnosis or local expert assessment.</p></div></Card>
    </div>
  </>;
}

function Metric({ icon: Icon, label, value }) { return <div className="weather-metric"><Icon size={16} /><span>{label}</span><b>{value}</b></div>; }
function WeatherIcon({ conditions = '', size = 21 }) {
  const value = conditions.toLowerCase();
  const Icon = /rain|storm|drizzle|snow|shower/.test(value) ? CloudRain : /cloud|overcast|fog|mist/.test(value) ? Cloud : Sun;
  return <Icon size={size} />;
}
function PriceRow({ row }) { return <div className="price-row"><div><b>{row.commodity || 'Commodity'}</b><span>{[row.market, row.district, row.marketDate || 'Date not reported'].filter(Boolean).join(' · ')}</span></div><div className="price-right"><b>{row.modalPrice == null ? '—' : `₹${row.modalPrice.toLocaleString('en-IN')}`}</b><span>modal / quintal</span></div></div>; }

function WeatherPage() {
  const { farmer } = useFarm();
  const weather = useRequest('/weather');
  return <><PageTitle eyebrow="WEATHER ASSISTANT" title="Plan with the forecast" description="Forecasts are fetched from a weather service. Farming suggestions are estimates, not observations of your field." action={<Link className="subtle-button" to="/profile"><MapPin size={15} />{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Set location'}</Link>} />
    <Card className="content-card">{weather.loading ? <LoadingBox /> : weather.error ? <ErrorNotice retry={weather.load}>{weather.error}</ErrorNotice> : <><div className="weather-detail-top"><div className="weather-big-icon"><WeatherIcon conditions={weather.data.current.conditions} size={31} /></div><div><span className="eyebrow">{weather.data.location}</span><div className="big-temperature">{Math.round(weather.data.current.temperatureC)}°<span>C</span></div><p className="capitalize">{weather.data.current.conditions}</p></div><div className="weather-detail-metrics"><Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} /><Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} /><Metric icon={CloudRain} label="Rainfall" value={`${weather.data.current.rainfallMm} mm`} /></div></div>
      <div className="section-heading compact-heading"><div><span className="eyebrow">NEXT DAYS</span><h2>5-day forecast</h2></div><span className="small-muted">Local forecast dates</span></div>
      <div className="forecast-grid">{weather.data.forecast.map(day => <div className="forecast-day" key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span><WeatherIcon conditions={day.conditions} size={21} /><b>{Math.round(day.maxC)}° <i>{Math.round(day.minC)}°</i></b><span className="forecast-rain"><Droplets size={13} />{day.rainMm} mm rain</span><span className="forecast-condition">{day.conditions}</span></div>)}</div>
      {(() => { const rainyDay = weather.data.forecast.find(day => day.rainMm > 0); return <div className="weather-advisory"><div className="advisory-icon"><ShieldCheck size={18} /></div><div><b>{rainyDay ? `Rain is forecast for ${new Date(`${rainyDay.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Use the forecast as a planning aid'}</b><p>{rainyDay ? `The service reports ${rainyDay.rainMm} mm of forecast rain for that date. Check drainage and field moisture before planning irrigation; local conditions may differ.` : 'No rainfall is listed in the returned forecast. Check soil moisture before irrigating; forecast detail may not reflect your exact village.'}</p></div></div>; })()}<MetaLine source={weather.data.source} time={weather.data.fetchedAt} /></>}</Card>
  </>;
}

function MarketsPage() {
  const { farmer } = useFarm();
  const [filters, setFilters] = useState({ commodity: '', state: farmer?.state || '', district: farmer?.district || '' });
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function search(event) { event?.preventDefault(); setLoading(true); setError(''); try { const { data } = await api.get('/mandi/prices', { params: filters }); setResult(data); } catch (e) { setResult(null); setError(errorMessage(e)); } finally { setLoading(false); } }
  useEffect(() => { search(); }, []);
  return <><PageTitle eyebrow="MARKET INTELLIGENCE" title="Know the mandi price" description="Browse reported prices from the official market data source. Each record carries its market date." />
    <Card className="content-card"><form onSubmit={search} className="filter-form"><Field label="Crop or commodity" placeholder="e.g. Tomato" value={filters.commodity} onChange={commodity => setFilters({ ...filters, commodity })} /><Field label="State" placeholder="e.g. Karnataka" value={filters.state} onChange={state => setFilters({ ...filters, state })} /><Field label="District" placeholder="e.g. Mysuru" value={filters.district} onChange={district => setFilters({ ...filters, district })} /><button className="primary-button search-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : null}Search prices</button></form>
      {loading && <LoadingBox label="Fetching reported market records…" />}{error && !loading && <ErrorNotice retry={search}>{error}</ErrorNotice>}
      {!loading && !error && result && <><div className="results-heading"><div><span className="eyebrow">{result.total} RECORDS</span><h2>Available mandi prices</h2></div><span className="rupee-note">Prices in ₹ per quintal</span></div>
        {result.records.length ? <div className="table-wrap"><table><thead><tr><th>Commodity</th><th>Mandi</th><th>Market date</th><th>Min</th><th>Max</th><th>Modal</th></tr></thead><tbody>{result.records.map((row, i) => <tr key={`${row.market}-${row.commodity}-${row.marketDate}-${i}`}><td><b>{row.commodity || '—'}</b></td><td>{row.market || '—'}<small>{row.district}{row.state ? `, ${row.state}` : ''}</small></td><td>{row.marketDate || 'Not reported'}</td><td>{formatRupees(row.minPrice)}</td><td>{formatRupees(row.maxPrice)}</td><td className="modal-price">{formatRupees(row.modalPrice)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><BadgeIndianRupee size={28} /><h3>No records found</h3><p>Try a wider location or a different crop. No price is estimated when records are missing.</p></div>}
        <MetaLine source={result.source} time={result.fetchedAt} />
      </>}
    </Card>
  </>;
}
function SchemesPage() {
  const { farmer } = useFarm();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = {
    en: { eyebrow: 'FARMER SUPPORT', title: 'Government schemes', description: 'Browse stored, source-linked scheme records. Results are not an eligibility decision.', loading: 'Loading scheme catalogue…', search: 'Search schemes', state: 'State', category: 'Category', allStates: 'All states', allCategories: 'All categories', central: 'Central scheme', stateScheme: 'State scheme', relevant: 'Potentially relevant', details: 'View scheme details', requirements: 'Check requirements', apply: 'How to apply', official: 'Visit official website', source: 'Verified source', close: 'Close details', noResults: 'No matching scheme records were found.', myScheme: 'Search more schemes on myScheme', income: 'Income support', insurance: 'Crop insurance', water: 'Water management' },
    hi: { eyebrow: 'किसान सहायता', title: 'सरकारी योजनाएं', description: 'स्रोत लिंक वाली संग्रहीत योजना जानकारी देखें। परिणाम पात्रता का निर्णय नहीं हैं।', loading: 'योजना सूची लोड हो रही है…', search: 'योजना खोजें', state: 'राज्य', category: 'श्रेणी', allStates: 'सभी राज्य', allCategories: 'सभी श्रेणियाँ', central: 'केंद्र योजना', stateScheme: 'राज्य योजना', relevant: 'संभवतः संबंधित', details: 'योजना विवरण देखें', requirements: 'योग्यता और शर्तें', apply: 'आवेदन कैसे करें', official: 'आधिकारिक वेबसाइट देखें', source: 'सत्यापित स्रोत', close: 'विवरण बंद करें', noResults: 'मिलती हुई योजना नहीं मिली।', myScheme: 'myScheme पर और योजनाएँ खोजें', income: 'आय सहायता', insurance: 'फसल बीमा', water: 'जल प्रबंधन' },
    kn: { eyebrow: 'ರೈತರ ನೆರವು', title: 'ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು', description: 'ಅಧಿಕೃತ ಮೂಲ ಲಿಂಕ್‌ಗಳೊಂದಿಗೆ ಉಳಿಸಿದ ಯೋಜನೆ ಮಾಹಿತಿಯನ್ನು ನೋಡಿ. ಫಲಿತಾಂಶಗಳು ಅರ್ಹತೆಯ ತೀರ್ಮಾನವಲ್ಲ.', loading: 'ಯೋಜನೆಗಳ ಪಟ್ಟಿಯನ್ನು ತರಲಾಗುತ್ತಿದೆ…', search: 'ಯೋಜನೆ ಹುಡುಕಿ', state: 'ರಾಜ್ಯ', category: 'ವಿಭಾಗ', allStates: 'ಎಲ್ಲಾ ರಾಜ್ಯಗಳು', allCategories: 'ಎಲ್ಲಾ ವಿಭಾಗಗಳು', central: 'ಕೇಂದ್ರ ಯೋಜನೆ', stateScheme: 'ರಾಜ್ಯ ಯೋಜನೆ', relevant: 'ಸಂಭವ್ಯವಾಗಿ ಸಂಬಂಧಿಸಬಹುದು', details: 'ಯೋಜನೆ ವಿವರ ನೋಡಿ', requirements: 'ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ', apply: 'ಅರ್ಜಿ ಹೇಗೆ', official: 'ಅಧಿಕೃತ ವೆಬ್‌ಸೈಟ್', source: 'ಪರಿಶೀಲಿಸಿದ ಮೂಲ', close: 'ವಿವರ ಮುಚ್ಚಿ', noResults: 'ಹೊಂದುವ ಯೋಜನೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.', myScheme: 'myScheme ನಲ್ಲಿ ಇನ್ನಷ್ಟು ಯೋಜನೆ ಹುಡುಕಿ', income: 'ಆದಾಯ ಸಹಾಯ', insurance: 'ಬೆಳೆ ವಿಮೆ', water: 'ನೀರಿನ ವ್ಯವಸ್ಥೆ' }
  }[language];
  const detailLabels = language === 'kn'
    ? { intendedFor: 'ಯಾರಿಗೆ', eligibility: 'ಅರ್ಹತೆ', benefits: 'ಪ್ರಯೋಜನಗಳು', documents: 'ಅಗತ್ಯ ದಾಖಲೆಗಳು', notEligibility: 'ಅರ್ಹತೆ ದೃಢೀಕರಣವಲ್ಲ', preferred: 'ಕನ್ನಡ ಅನುವಾದ', original: 'ಮೂಲ ಇಂಗ್ಲಿಷ್', translatedNotice: 'ಇದು ಮೂಲ ಮಾಹಿತಿಯ ಅನುವಾದಿತ ವಿವರಣೆ; ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಅನುವಾದವಲ್ಲ. ಸ್ಥಳೀಯ ಭಾಷಾ ಪರಿಶೀಲನೆ ಬಾಕಿಯಿದೆ.', unavailableNotice: 'ಈ ಭಾಷೆಯ ಅನುವಾದ ಲಭ್ಯವಿಲ್ಲ. ಮೂಲ ಇಂಗ್ಲಿಷ್ ವಿಷಯವನ್ನು ತೋರಿಸಲಾಗಿದೆ.' }
    : language === 'hi'
      ? { intendedFor: 'किसके लिए', eligibility: 'पात्रता', benefits: 'लाभ', documents: 'ज़रूरी दस्तावेज़', notEligibility: 'पात्रता की पुष्टि नहीं', preferred: 'हिंदी अनुवाद', original: 'मूल अंग्रेज़ी', translatedNotice: 'यह मूल जानकारी का अनुवादित विवरण है, आधिकारिक सरकारी अनुवाद नहीं। स्थानीय भाषा की समीक्षा बाकी है।', unavailableNotice: 'इस भाषा में अनुवाद उपलब्ध नहीं है। मूल अंग्रेज़ी सामग्री दिखाई गई है।' }
      : { intendedFor: 'Who it is for', eligibility: 'Eligibility', benefits: 'Benefits', documents: 'Required documents', notEligibility: 'not eligibility confirmation', preferred: 'Selected language', original: 'Original English', translatedNotice: 'This is a translated explanation of the source, not an official government translation. Native-speaker review is pending.', unavailableNotice: 'A translation is not available in this language. Original English content is shown.' };
  const extraLabels = language === 'kn'
    ? { catalogue: 'ಮೂಲ ಹೊಂದಿರುವ ಯೋಜನೆಗಳ ಪಟ್ಟಿ', verified: 'ಮೂಲ ಪರಿಶೀಲಿಸಿದ ದಿನಾಂಕ:', karnataka: 'ಕರ್ನಾಟಕ', allIndia: 'ಭಾರತದಾದ್ಯಂತ' }
    : language === 'hi'
      ? { catalogue: 'स्रोत-सहित योजना सूची', verified: 'स्रोत जाँच की तारीख:', karnataka: 'कर्नाटक', allIndia: 'पूरे भारत में' }
      : { catalogue: 'Source-linked scheme catalogue', verified: 'Source checked:', karnataka: 'Karnataka', allIndia: 'All India' };
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

function formatRupees(value) { return value == null ? '—' : `₹${Number(value).toLocaleString('en-IN')}`; }

function AdviceResult({ result, title = 'Saathi’s guidance' }) { return result ? <Card className="result-card"><div className="result-head"><span className="result-icon"><Leaf size={18} /></span><div><span className="eyebrow">AI-GENERATED GUIDANCE</span><h3>{title}</h3></div><span className="ai-pill">{result.source}</span></div><div className="answer-text">{result.answer}</div><div className="result-disclaimer"><ShieldCheck size={15} />General guidance can be incomplete. Check local conditions and consult an agriculture expert for important decisions.</div><MetaLine source={result.source} time={result.generatedAt} /></Card> : null; }
function AdviceForm({ endpoint, submitLabel, title, children, buildBody, requireFile = false }) {
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event) { event.preventDefault(); setError(''); setLoading(true); try { const { data } = await api.post(endpoint, buildBody(event.currentTarget), requireFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined); setResult(data); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }
  return <><Card className="form-card"><form onSubmit={submit} className="form-stack">{children}{error && <ErrorNotice>{error}</ErrorNotice>}<button disabled={loading} className="primary-button form-submit">{loading ? <LoaderCircle className="spin" size={17} /> : null}{submitLabel}<ArrowRight size={17} /></button></form></Card>{result && <AdviceResult result={result} title={title} />}</>;
}

function CropsPage() {
  const { farmer } = useFarm();
  return <><PageTitle eyebrow="CROP ADVISOR" title="Explore what may grow well" description="Suggestions use only the farm details you’ve supplied. Missing soil or weather information is not filled in." />
    <div className="two-column-layout"><div className="side-context"><Card className="profile-context"><div className="context-top"><span className="feature-icon"><Sprout size={19} /></span><span className="eyebrow">YOUR FARM DETAILS</span></div><h3>{farmer?.village || farmer?.district || 'Location not set'}</h3><p>{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Add your location to personalize crop guidance.'}</p><div className="context-list"><ContextRow label="Soil" value={farmer?.soil?.type || 'Not provided'} /><ContextRow label="Farm size" value={farmer?.farmSize ? `${farmer.farmSize} acres` : 'Not provided'} /><ContextRow label="Current crops" value={farmer?.currentCrops?.join(', ') || 'Not provided'} /><ContextRow label="Water" value={farmer?.irrigationFacilities?.join(', ') || 'Not provided'} /></div><Link className="text-link" to="/profile">Update farm details <ArrowRight size={15} /></Link></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Information may be incomplete</b><p>AI advice is a starting point. Confirm planting choices with local agricultural guidance and current conditions.</p></div></div></div>
      <AdviceForm endpoint="/ai/crop-recommendations" title="Crop suggestions" submitLabel="Get crop ideas" buildBody={form => ({ details: form.elements.details.value })}><label className="field"><span>What are you planning for?</span><textarea name="details" rows="5" placeholder="For example: planning a crop for the coming monsoon, limited irrigation, harvested groundnut last season…" /></label><p className="field-hint">Optional: add season, planting plans or field observations. Soil measurements are read from your profile only if you entered them.</p></AdviceForm>
    </div></>;
}
function ContextRow({ label, value }) { return <div className="context-row"><span>{label}</span><b>{value}</b></div>; }

function AssistantPage() {
  const { farmer, setFarmer } = useFarm();
  const navigate = useNavigate();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = assistantCopy[language];
  const firstName = farmer?.name?.split(' ')[0] || '';
  const greeting = `${serviceCopy[language].greeting(firstName)} ${serviceCopy[language].intro}`;
  const [messages, setMessages] = useState([{ role: 'assistant', answer: greeting }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [locationRequest, setLocationRequest] = useState('');
  const [locationToConfirm, setLocationToConfirm] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  function handleVoiceCommand(message) {
    const text = message.toLocaleLowerCase();
    if (/^(repeat|दोहराएं|पुनः सुनाएं|ಮತ್ತೆ ಹೇಳಿ|ಮತ್ತೆ ಕೇಳಿ)$/.test(text)) {
      const lastAssistant = [...messages].reverse().find(item => item.role === 'assistant');
      if (lastAssistant) speak(lastAssistant.answer);
      return true;
    }
    if (/^(home|main menu|मुख्य पृष्ठ|होम|ಮುಖ್ಯ ಪುಟ|ಹೋಮ್)$/.test(text)) { navigate('/dashboard'); return true; }
    if (/^(stop speaking|रुकिए|बोलना बंद करें|ಮಾತು ನಿಲ್ಲಿಸಿ|ನಿಲ್ಲಿಸಿ)$/.test(text)) { stopSpeaking(); return true; }
    if (/^(new conversation|नई बातचीत|ಹೊಸ ಸಂಭಾಷಣೆ)$/.test(text)) { startNewConversation(); return true; }
    if (/weather|हवामान|मौसम|हवामान|ಹವಾಮಾನ|मौसम/.test(text)) { navigate('/weather'); return true; }
    if (/mandi|market|भाव|मंडी|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ/.test(text)) { navigate('/markets'); return true; }
    if (/crop disease|crop problem|रोग|बीमारी|ಬೆಳೆ ಸಮಸ್ಯೆ|ರೋಗ/.test(text)) { navigate('/disease'); return true; }
    if (/irrigation|supply|सिंचाई|पानी|ನೀರಾವರಿ/.test(text)) { navigate('/irrigation'); return true; }
    if (/crop recommendation|choose crop|फसल चुन|फसल सलाह|ಬೆಳೆ ಆಯ್ಕೆ|ಬೆಳೆ ಸಲಹೆ/.test(text)) { navigate('/crops'); return true; }
    return false;
  }

  async function speak(text) {
    setSpeechError('');
    const result = await speakText(text, language);
    if (!result.ok && result.reason !== 'cancelled') {
      setSpeechError(result.reason === 'unsupported' ? copy.voiceUnsupported : copy.voiceMissing);
    }
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

  function startListening() {
    const recognition = createSpeechRecognition(language);
    if (!recognition) { setSpeechError(copy.voiceUnsupported); return; }
    try {
      recognitionRef.current = recognition;
      recognition.onstart = () => { setListening(true); setSpeechError(''); };
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setListening(false); recognitionRef.current = null; setSpeechError(copy.voiceError); };
      recognition.onresult = event => setInput(event.results?.[0]?.[0]?.transcript || '');
      recognition.start();
    } catch { setListening(false); setSpeechError(copy.voiceError); }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function startNewConversation() {
    stopListening();
    stopSpeaking();
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
  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={<span className="language-badge"><Globe2 size={15} />{({ en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ' }[language])}</span>} />
    <Card className="chat-card">
      <div className="chat-heading"><span className="assistant-avatar"><Leaf size={19} /></span><div><b>Saathi</b><span>{copy.eyebrow} · {({ en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ' }[language])}</span></div><span className="chat-status"><span className="status-dot" />{copy.ready}</span></div>
      <div className="assistant-actions" aria-label="Assistant actions">
        <button type="button" onClick={() => lastAssistant && speak(lastAssistant.answer)}><Volume2 size={16} />{copy.listen}</button>
        <button type="button" onClick={stopSpeaking}><VolumeX size={16} />{copy.stopSpeaking}</button>
        <button type="button" onClick={startNewConversation}><Plus size={16} />{copy.newConversation}</button>
        <button type="button" onClick={() => navigate('/dashboard')}><House size={16} />{copy.home}</button>
      </div>
      <div className="message-list">{messages.map((message, i) => <div key={i} className={`message-row ${message.role === 'user' ? 'message-user' : ''}`}><div className="message-avatar">{message.role === 'assistant' ? <Leaf size={14} /> : <UserRound size={14} />}</div><div className="message-content"><div className={`message-bubble ${message.role === 'user' ? 'bubble-user' : ''}`}>{message.answer}</div>{message.role === 'assistant' && <button className="speak-button" onClick={() => speak(message.answer)}><Volume2 size={14} />{copy.listen}</button>}</div></div>)}{loading && <div className="typing-indicator"><span /><span /><span /> Saathi is thinking…</div>}</div>
      {locationToConfirm && <div className="location-confirm"><button className="primary-button" type="button" onClick={confirmLocation}><Check size={17} />{copy.confirm}</button><button className="subtle-button" type="button" onClick={cancelLocation}>{copy.change}</button></div>}
      {error && <div className="chat-error"><ErrorNotice>{error}</ErrorNotice></div>}{speechError && <div className="chat-error"><ErrorNotice retry={startListening}>{speechError}</ErrorNotice></div>}
      <form className="chat-composer" onSubmit={send}>
        <button className={`mic-button ${listening ? 'mic-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? copy.stopListening : copy.microphone}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={copy.composer} aria-label={copy.composer} />
        <button className="send-button" disabled={!input.trim() || loading} aria-label={copy.send}><Send size={18} /></button>
      </form>
      <div className="composer-note">{copy.description}</div>
    </Card>
  </>;
}

function IrrigationPage() {
  return <><PageTitle eyebrow="WATER PLANNING" title="Think through irrigation" description="Get a cautious checklist based on your crop, stage and any rainfall information you share." />
    <div className="two-column-layout"><div className="side-context"><Card className="irrigation-info"><span className="feature-icon"><Droplets size={20} /></span><h3>Before you water</h3><div className="check-list"><div><Check size={15} /><span>Check soil moisture at the root zone.</span></div><div><Check size={15} /><span>Account for recent and expected rain.</span></div><div><Check size={15} /><span>Use the crop’s growth stage as a guide.</span></div><div><Check size={15} /><span>Follow local agriculture advice for exact timing.</span></div></div><p>Saathi won’t estimate a soil moisture reading or give a precise schedule from missing data.</p></Card></div>
      <AdviceForm endpoint="/ai/irrigation" title="Irrigation guidance" submitLabel="Get irrigation guidance" buildBody={form => ({ crop: form.elements.crop.value, growthStage: form.elements.stage.value, rainfall: form.elements.rainfall.value })}>
        <Field label="Crop" name="crop" placeholder="e.g. Cotton" value={undefined} onChange={() => {}} />
        <label className="field"><span>Growth stage</span><select name="stage" defaultValue=""><option value="">Select if known</option><option>Recently sown</option><option>Vegetative growth</option><option>Flowering</option><option>Fruit or grain formation</option><option>Near harvest</option></select></label>
        <Field label="Expected or recent rainfall" placeholder="e.g. Moderate rain yesterday" value={undefined} onChange={() => {}} name="rainfall" />
        <p className="field-hint">Farm profile information, including soil type and water access, is also shared with the AI when available.</p>
      </AdviceForm>
    </div></>;
}

function DiseasePage() {
  const [fileName, setFileName] = useState('');
  return <><PageTitle eyebrow="CROP HEALTH" title="Describe what you see" description="Share symptoms for possible causes and safe next steps. This is not a confirmed diagnosis." />
    <div className="two-column-layout"><div className="side-context"><Card className="disease-info"><span className="disease-mark"><Activity size={20} /></span><h3>Help Saathi understand</h3><div className="symptom-examples"><span>Which crop is affected?</span><span>When did the symptoms begin?</span><span>Are there spots, insects or wilting?</span><span>Has the weather changed recently?</span></div><p>For serious damage or fast spread, contact a local agriculture expert or Krishi Vigyan Kendra.</p></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Be careful with treatments</b><p>No pesticide mixtures or unsupported dosages will be suggested.</p></div></div></div>
      <AdviceForm endpoint="/disease/analyze" requireFile title="Possible causes" submitLabel="Review symptoms" buildBody={form => { const body = new FormData(); body.append('symptoms', form.elements.symptoms.value); if (form.elements.image.files[0]) body.append('image', form.elements.image.files[0]); return body; }}>
        <label className="field"><span>What are you noticing?</span><textarea name="symptoms" rows="6" placeholder="Describe the crop, affected parts, when it started, and any visible changes…" /></label>
        <label className="upload-box"><input name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFileName(e.target.files[0]?.name || '')} /><span className="upload-icon"><Upload size={18} /></span><span><b>{fileName || 'Add a crop photo (optional)'}</b><small>JPG, PNG or WebP · up to 5 MB</small></span><Plus size={18} /></label>
        <p className="field-hint">A photo can help, but image analysis may miss important details. Avoid including people or personal information.</p>
      </AdviceForm>
    </div></>;
}

function ProfilePage() {
  const { farmer, setFarmer } = useFarm();
  const [form, setForm] = useState(() => farmerToForm(farmer));
  const [saved, setSaved] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(farmerToForm(farmer)); }, [farmer]);
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function submit(event) {
    event.preventDefault(); setSaved(false); setError(''); setBusy(true);
    const body = {
      name: form.name, state: form.state, district: form.district, village: form.village,
      preferredLanguage: form.preferredLanguage, farmSize: form.farmSize ? Number(form.farmSize) : null,
      soil: { type: form.soilType, nitrogen: optionalNumber(form.nitrogen), phosphorus: optionalNumber(form.phosphorus), potassium: optionalNumber(form.potassium), ph: optionalNumber(form.ph) },
      irrigationFacilities: splitList(form.irrigationFacilities), currentCrops: splitList(form.currentCrops)
    };
    try { const { data } = await api.put(`/farmers/profile/${farmer._id}`, body); setFarmer(data.farmer); setSaved(true); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <><PageTitle eyebrow="YOUR FARM PROFILE" title="Keep your farm details close" description="Saathi uses saved details to avoid asking you the same questions again. Add only what you know." />
    <Card className="profile-form-card"><form onSubmit={submit} className="form-stack"><div className="profile-section-title"><span className="profile-section-icon"><UserRound size={18} /></span><div><h2>About you and your farm</h2><p>These details stay linked to your account.</p></div></div>
      <div className="field-grid"><Field label="Farmer name" value={form.name} onChange={v => set('name', v)} required /><Field label="Email address" value={farmer?.email || ''} onChange={() => {}} type="email" disabled /></div>
      <div className="field-grid three-fields"><Field label="State" value={form.state} onChange={v => set('state', v)} placeholder="e.g. Karnataka" /><Field label="District" value={form.district} onChange={v => set('district', v)} placeholder="e.g. Mysuru" /><Field label="Village or town" value={form.village} onChange={v => set('village', v)} placeholder="e.g. Hunsur" /></div>
      <div className="field-grid three-fields"><label className="field"><span>Preferred language</span><select value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="kn">ಕನ್ನಡ</option></select></label><Field label="Farm size (acres)" type="number" min="0" step="0.1" value={form.farmSize} onChange={v => set('farmSize', v)} placeholder="Optional" /><Field label="Soil type" value={form.soilType} onChange={v => set('soilType', v)} placeholder="e.g. Red loam" /></div>
      <div className="profile-divider" /><div className="profile-section-title"><span className="profile-section-icon"><Sprout size={18} /></span><div><h2>Soil and crop details</h2><p>Soil test values are optional. Leave them blank if you don’t know them.</p></div></div>
      <div className="field-grid four-fields"><Field label="Nitrogen (N)" type="number" min="0" value={form.nitrogen} onChange={v => set('nitrogen', v)} placeholder="Not measured" /><Field label="Phosphorus (P)" type="number" min="0" value={form.phosphorus} onChange={v => set('phosphorus', v)} placeholder="Not measured" /><Field label="Potassium (K)" type="number" min="0" value={form.potassium} onChange={v => set('potassium', v)} placeholder="Not measured" /><Field label="Soil pH" type="number" min="0" max="14" step="0.1" value={form.ph} onChange={v => set('ph', v)} placeholder="Not measured" /></div>
      <div className="field-grid"><Field label="Current crops" value={form.currentCrops} onChange={v => set('currentCrops', v)} placeholder="Separate crops with commas" /><Field label="Irrigation facilities" value={form.irrigationFacilities} onChange={v => set('irrigationFacilities', v)} placeholder="e.g. Borewell, drip (comma separated)" /></div>
      {saved && <div className="alert alert-success"><Check size={17} />Your farm profile has been saved.</div>}{error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="form-footer"><span><ShieldCheck size={15} />Only you can view and update your farm profile.</span><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{words[farmer?.preferredLanguage]?.save || 'Save changes'}</button></div>
    </form></Card>
  </>;
}

function farmerToForm(farmer = {}) { return { name: farmer.name || '', state: farmer.state || '', district: farmer.district || '', village: farmer.village || '', preferredLanguage: farmer.preferredLanguage || 'en', farmSize: farmer.farmSize ?? '', soilType: farmer.soil?.type || '', nitrogen: farmer.soil?.nitrogen ?? '', phosphorus: farmer.soil?.phosphorus ?? '', potassium: farmer.soil?.potassium ?? '', ph: farmer.soil?.ph ?? '', irrigationFacilities: farmer.irrigationFacilities?.join(', ') || '', currentCrops: farmer.currentCrops?.join(', ') || '' }; }
function optionalNumber(value) { return value === '' ? undefined : Number(value); }
function splitList(value) { return value.split(',').map(part => part.trim()).filter(Boolean).slice(0, 20); }
