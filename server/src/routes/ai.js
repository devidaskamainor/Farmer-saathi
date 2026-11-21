import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { askGroq, localizeAssistantText } from '../services/groq.js';
import { getMandiPrices } from '../services/mandi.js';
import { getWeather } from '../services/weather.js';
import { detectIntent } from '../services/intent.js';
import { potentiallyRelevantSchemes } from '../services/schemes.js';
import { HttpError } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

// Route conversational questions through the existing data and advice services.
router.post('/ask', async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message || message.length > 2000) throw new HttpError(400, 'Enter a question of up to 2,000 characters.');
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const conversation = history.map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'farmer',
      text: String(item?.text || '').slice(0, 1000),
      intent: typeof item?.intent === 'string' ? item.intent : '',
      action: typeof item?.action === 'string' ? item.action : ''
    })).filter(item => item.text);
    const location = farmerLocation(req.farmer);
    const recentContext = conversation.length ? `Recent conversation (for context only): ${JSON.stringify(conversation)}\n\n` : '';
    const previousAssistant = [...conversation].reverse().find(item => item.role === 'assistant');
    let intent = detectIntent(message);
    if (intent === 'UNKNOWN_INTENT' && previousAssistant?.action === 'ask_crop') intent = 'MANDI_PRICE';

    if (intent === 'WEATHER_QUERY') {
      if (!location) return res.json({ intent, action: 'ask_location', answer: await localizeAssistantText(req.farmer, localizedLocationPrompt(req.farmer.preferredLanguage)), source: 'Location required', generatedAt: new Date().toISOString() });
      let weather;
      try {
        weather = await getWeather(location);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        return res.json({ intent, answer: await localizeAssistantText(req.farmer, localizedUnavailable(req.farmer.preferredLanguage, 'weather')), source: 'Weather data unavailable', generatedAt: new Date().toISOString() });
      }
      const result = await askGroq({ farmer: req.farmer, task: 'Answer using only the verified current weather and forecast data below. Do not add forecast details that are absent from the data.', prompt: `${recentContext}${message}\n\nVerified weather data (${weather.source}, fetched ${weather.fetchedAt}): ${JSON.stringify(weather)}` });
      return res.json({ ...result, intent, source: `${weather.source} + ${result.source}` });
    }

    if (intent === 'MANDI_PRICE') {
      if (!req.farmer.state && !req.farmer.district) return res.json({ intent, action: 'ask_location', answer: await localizeAssistantText(req.farmer, localizedLocationPrompt(req.farmer.preferredLanguage)), source: 'Location required', generatedAt: new Date().toISOString() });
      const commodity = findCommodity(message);
      if (!commodity) return res.json({ intent, action: 'ask_crop', answer: await localizeAssistantText(req.farmer, localizedCommodityPrompt(req.farmer.preferredLanguage)), source: 'Clarification needed', generatedAt: new Date().toISOString() });
      let markets;
      try {
        markets = await getMandiPrices({ state: req.farmer.state, district: req.farmer.district, commodity });
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        return res.json({ intent, answer: await localizeAssistantText(req.farmer, localizedUnavailable(req.farmer.preferredLanguage, 'market')), source: 'Market data unavailable', generatedAt: new Date().toISOString() });
      }
      const result = await askGroq({ farmer: req.farmer, task: 'Answer using only the official mandi records below. Include market name, reported date, and modal price where available. If no records are returned, say so. Never call these prices live unless their record date supports that.', prompt: `${recentContext}${message}\n\nOfficial reported market data (${markets.source}, fetched ${markets.fetchedAt}): ${JSON.stringify({ ...markets, records: markets.records.slice(0, 20) })}` });
      return res.json({ ...result, intent, source: `${markets.source} + ${result.source}` });
    }

    if (intent === 'GOVERNMENT_SCHEME') {
      const schemeAnswer = await localizeAssistantText(req.farmer, localizedSchemeAnswer(req.farmer));
      return res.json({ intent, answer: schemeAnswer, source: 'Verified scheme catalogue', generatedAt: new Date().toISOString(), action: 'open_schemes' });
    }
    if (intent === 'UNKNOWN_INTENT') {
      return res.json({ intent, answer: await localizeAssistantText(req.farmer, localizedUnknownPrompt(req.farmer.preferredLanguage)), source: 'Clarification needed', generatedAt: new Date().toISOString() });
    }

    const taskByIntent = {
      CROP_RECOMMENDATION: 'Crop recommendation',
      CROP_DISEASE: 'Crop disease and symptom guidance',
      IRRIGATION_ADVICE: 'Irrigation guidance using profile and current forecast when available',
      SOIL_ADVICE: 'Soil guidance using only soil details already provided in the farmer profile',
      GENERAL_FARMING_QUESTION: 'Answer the farmer’s agricultural question'
    };
    const weather = ['CROP_RECOMMENDATION', 'IRRIGATION_ADVICE'].includes(intent) ? await optionalWeather(req.farmer) : null;
    const taskPrompt = intent === 'CROP_RECOMMENDATION'
      ? `Suggest up to three suitable crops from known profile details. Explain what information is missing. Do not invent measurements, exact yields, or guaranteed planting dates. Verified weather when available: ${JSON.stringify(weather?.data || { unavailable: weather?.reason || 'not configured' })}`
      : intent === 'CROP_DISEASE'
        ? 'Assess reported crop symptoms as possible causes, not a confirmed diagnosis. Ask a short follow-up only if essential details are missing. Give safe crop-care steps and when to contact a local agriculture expert. Do not recommend pesticide mixtures or dosages.'
        : intent === 'IRRIGATION_ADVICE'
          ? `Give a cautious irrigation checklist based on known crop, soil, water access, growth stage, and this verified forecast when available: ${JSON.stringify(weather?.data || { unavailable: weather?.reason || 'not configured' })}. Do not invent soil moisture or a precise schedule.`
          : intent === 'SOIL_ADVICE'
            ? 'Give practical soil guidance based on measured values or soil type already supplied in the profile. State what is unknown. Never invent soil test values, and ask for the soil type or measured values when needed.'
            : 'Answer the farmer’s agricultural question. If it needs current weather or market records, explain that this answer cannot replace those live data services.';
    const result = await askGroq({ farmer: req.farmer, task: taskByIntent[intent], prompt: `${recentContext}${message}\n\n${taskPrompt}` });
    res.json({ ...result, intent, ...(weather?.data ? { contextSource: weather.source } : {}) });
  } catch (error) { next(error); }
});

router.post('/crop-recommendations', async (req, res, next) => {
  try {
    const extra = String(req.body?.details || '').trim();
    if (extra.length > 1500) throw new HttpError(400, 'Additional details must be under 1,500 characters.');
    const weather = await optionalWeather(req.farmer);
    const prompt = `Recommend up to three crops that could suit the known profile and these additional details: ${extra || 'none provided'}. For each, give the reason, a planting window only if you can support it and label it as general/local timing to verify, water needs, basic fertilizer guidance without invented measurements, and key risks. Start by listing any important missing information. Do not state a specific yield. Weather context (if available): ${JSON.stringify(weather.data || { unavailable: weather.reason })}`;
    const result = await askGroq({ farmer: req.farmer, task: 'Crop recommendation', prompt });
    res.json({ ...result, source: weather.data ? `${result.source} + ${weather.source}` : result.source });
  } catch (error) { next(error); }
});

router.post('/irrigation', async (req, res, next) => {
  try {
    const { crop = '', growthStage = '', rainfall = '' } = req.body || {};
    if ([crop, growthStage, rainfall].some(value => String(value).length > 150)) throw new HttpError(400, 'Please keep crop, growth stage, and rainfall details brief.');
    const weather = await optionalWeather(req.farmer);
    const prompt = `Give a cautious irrigation advisory. Crop: ${crop || 'not provided'}. Growth stage: ${growthStage || 'not provided'}. Farmer-reported expected rainfall: ${rainfall || 'not provided'}. Explain what to check before watering, how to account for rain and soil type, water-saving practices, and what information is missing. Do not present a precise schedule or soil moisture reading. Verified forecast context (if available): ${JSON.stringify(weather.data || { unavailable: weather.reason })}`;
    const result = await askGroq({ farmer: req.farmer, task: 'Irrigation planning', prompt });
    res.json({ ...result, source: weather.data ? `${result.source} + ${weather.source}` : result.source });
  } catch (error) { next(error); }
});

router.post('/crop-protection', async (req, res, next) => {
  try {
    const symptoms = String(req.body?.symptoms || '').trim();
    if (!symptoms || symptoms.length > 2000) throw new HttpError(400, 'Describe the symptoms in up to 2,000 characters.');
    const prompt = `Assess these reported crop symptoms: ${symptoms}. Give possible causes (not a confirmed diagnosis), the observations that support each possibility, safe preventive crop care, and signs that require help from a local agricultural expert or Krishi Vigyan Kendra. Do not recommend pesticide mixtures or dosages.`;
    res.json(await askGroq({ farmer: req.farmer, task: 'Crop disease and protection guidance', prompt }));
  } catch (error) { next(error); }
});

const cropAliases = [
  ['Tomato', ['tomato', 'टमाटर', 'ಟೊಮೇಟೊ']], ['Onion', ['onion', 'प्याज', 'ಈರುಳ್ಳಿ']],
  ['Potato', ['potato', 'आलू', 'ಆಲೂಗಡ್ಡೆ']], ['Rice', ['rice', 'paddy', 'धान', 'ಅಕ್ಕಿ']],
  ['Wheat', ['wheat', 'गेहूं', 'ಗೋಧಿ']], ['Maize', ['maize', 'corn', 'मक्का', 'ಮೆಕ್ಕೆಜೋಳ']],
  ['Cotton', ['cotton', 'कपास', 'ಹತ್ತಿ']], ['Groundnut', ['groundnut', 'peanut', 'मूंगफली', 'ಕಡಲೆಕಾಯಿ']],
  ['Soybean', ['soybean', 'सोयाबीन', 'ಸೋಯಾಬೀನ್']], ['Chilli', ['chilli', 'chili', 'मिर्च', 'ಮೆಣಸಿನಕಾಯಿ']],
  ['Banana', ['banana', 'केला', 'ಬಾಳೆಹಣ್ಣು']], ['Sugarcane', ['sugarcane', 'गन्ना', 'ಕಬ್ಬು']],
  ['Tur', ['tur', 'pigeon pea', 'अरहर', 'ತೊಗರಿ']]
];

function findCommodity(message) {
  const normalized = message.toLocaleLowerCase();
  return cropAliases.find(([, aliases]) => aliases.some(alias => {
    const value = alias.toLocaleLowerCase();
    if (/^[a-z\s]+$/i.test(value)) {
      const pattern = value.split(/\s+/).map(word => `${word}(?:s|es)?`).join('\\s+');
      return new RegExp(`\\b${pattern}\\b`, 'i').test(normalized);
    }
    return normalized.includes(value);
  }))?.[0] || '';
}

function isWeatherQuestion(message) {
  return /\b(weather|forecast|rain|raining|temperature|humidity)\b|मौसम|बारिश|बरसात|तापमान|ಹವಾಮಾನ|ಮಳೆ|ಮಳೆಯ|ತಾಪಮಾನ/i.test(message);
}

function isMarketQuestion(message) {
  return /mandi|market price|price\b|prices|selling price|भाव|कीमत|मंडी|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ/i.test(message);
}

function farmerLocation(farmer) { return [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', '); }

async function optionalWeather(farmer) {
  try { return { data: await getWeather(farmerLocation(farmer)), source: 'OpenWeather' }; }
  catch (error) { return { data: null, reason: error.message, source: '' }; }
}

function localizedUnavailable(language, kind) {
  const messages = {
    en: { weather: 'I couldn’t retrieve a current forecast. Check your saved village or district and try again later.', market: 'I couldn’t retrieve official mandi records. No price has been estimated; please try again later.' },
    hi: { weather: 'अभी मौसम का ताज़ा पूर्वानुमान नहीं मिल सका। अपना गाँव या ज़िला जाँचें और बाद में फिर कोशिश करें।', market: 'अभी आधिकारिक मंडी रिकॉर्ड नहीं मिल सके। कोई भाव अनुमान से नहीं बताया गया है; बाद में फिर कोशिश करें।' },
    kn: { weather: 'ಈಗ ಹವಾಮಾನದ ಇತ್ತೀಚಿನ ಮುನ್ಸೂಚನೆ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಗ್ರಾಮ ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ಪರಿಶೀಲಿಸಿ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', market: 'ಈಗ ಅಧಿಕೃತ ಮಾರುಕಟ್ಟೆ ದಾಖಲೆಗಳನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಯಾವುದೇ ಬೆಲೆಯನ್ನು ಊಹಿಸಿ ಹೇಳಿಲ್ಲ; ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }
  };
  return (messages[language] || messages.en)[kind];
}

function localizedLocationPrompt(language) {
  return ({
    en: 'Which village, town, or district should I use? I will show it to you for confirmation before saving it to your profile.',
    hi: 'मैं किस गाँव, कस्बे या ज़िले का उपयोग करूँ? आपकी प्रोफ़ाइल में सहेजने से पहले मैं आपसे पुष्टि करूँगा।',
    kn: 'ಯಾವ ಗ್ರಾಮ, ಊರು ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ಬಳಸಲಿ? ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ ಉಳಿಸುವ ಮೊದಲು ನಿಮ್ಮ ದೃಢೀಕರಣ ಕೇಳುತ್ತೇನೆ.'
  })[language] || 'Which village or district should I use?';
}

function localizedUnknownPrompt(language) {
  return ({
    en: 'I did not understand that. You can ask about weather, crop choices, crop problems, watering, soil, market prices, or government schemes.',
    hi: 'मैं यह समझ नहीं पाया। आप मौसम, फसल चुनने, फसल की समस्या, सिंचाई, मिट्टी, मंडी भाव या सरकारी योजनाओं के बारे में पूछ सकते हैं।',
    kn: 'ನನಗೆ ಅದು ಅರ್ಥವಾಗಲಿಲ್ಲ. ಹವಾಮಾನ, ಬೆಳೆ ಆಯ್ಕೆ, ಬೆಳೆ ಸಮಸ್ಯೆ, ನೀರಾವರಿ, ಮಣ್ಣು, ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಅಥವಾ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಕೇಳಬಹುದು.'
  })[language] || 'Please ask about a farming service.';
}

function localizedSchemeAnswer(farmer) {
  const schemes = potentiallyRelevantSchemes(farmer);
  const names = schemes.map(scheme => scheme.name).slice(0, 4).join(', ');
  return ({
    en: `I found potentially relevant verified scheme records: ${names}. Open the Government Schemes page to check requirements and official links. This is not an eligibility decision.`,
    hi: `संभावित रूप से संबंधित सत्यापित योजनाएँ मिली हैं: ${names}। शर्तें और आधिकारिक लिंक देखने के लिए सरकारी योजनाएँ पेज खोलें। यह पात्रता का निर्णय नहीं है।`,
    kn: `ಸಂಭಾವ್ಯವಾಗಿ ಸಂಬಂಧಿಸಿದ ಪರಿಶೀಲಿಸಿದ ಯೋಜನೆಗಳು: ${names}. ಶರತ್ತುಗಳು ಮತ್ತು ಅಧಿಕೃತ ಲಿಂಕ್‌ಗಳಿಗೆ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಪುಟ ತೆರೆಯಿರಿ. ಇದು ಅರ್ಹತೆಯ ತೀರ್ಮಾನವಲ್ಲ.`
  })[farmer.preferredLanguage] || `I found potentially relevant verified scheme records: ${names}. Open the Government Schemes page to check requirements and official links.`;
}

function localizedCommodityPrompt(language) {
  return ({
    en: 'Which crop’s mandi price would you like? Please include its name, for example tomato, onion, rice, or cotton.',
    hi: 'आप किस फसल का मंडी भाव जानना चाहते हैं? कृपया फसल का नाम लिखें, जैसे टमाटर, प्याज, धान या कपास।',
    kn: 'ಯಾವ ಬೆಳೆಯ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಬೇಕು? ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಅಕ್ಕಿ ಅಥವಾ ಹತ್ತಿ ಎಂಬಂತೆ ಬೆಳೆಯ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.'
  })[language] || 'Which crop’s mandi price would you like? Please include its name.';
}

export default router;
