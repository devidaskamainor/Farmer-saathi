const intentRules = [
  ['TRANSLATION_QUERY', /\b(translat\w*|tell\s+(?:me\s+)?in|say\s+in|speak\s+in|explain\s+in|in\s+(?:kannada|hindi|tamil|telugu|marathi|bengali|gujarati|punjabi|malayalam|odia|assamese|urdu|english))\b|ಅನುವಾದ|ಕನ್ನಡದಲ್ಲಿ|ಹಿಂದಿಯಲ್ಲಿ|ತಮಿಳಿನಲ್ಲಿ|ತೆಲುಗಿನಲ್ಲಿ|मराठीत|अनुवाद|हिंदी में|कन्नड़ में|कन्नड में|तमिल में|तेलुगु में|मराठी में|বাংলায়|ગુજરાતીમાં|ਪੰਜਾਬੀ ਵਿੱਚ|മലയാളത്തിൽ|ଓଡ଼ିଆରେ/i],
  ['WEATHER_QUERY', /\b(weather|forecast|rain|raining|temperature|humidity|tomorrow rain)\b|मौसम|बारिश|बरसात|वर्षा|तापमान|ಹವಾಮಾನ|ಮಳೆ|ಮಳೆಯ|ಮುನ್ಸೂಚನೆ/i],
  ['MANDI_PRICE', /\b(mandi|market price|price|prices|selling price)\b|मंडी|भाव|कीमत|बाज़ार|बाजार भाव|मंडी भाव|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ|ಮಂಡಿ/i],
  ['GOVERNMENT_SCHEME', /\b(schemes?|government benefits?|farmer benefits?)\b|योजना|योजनाओं|सरकारी योजना|सरकारी योजनाएं|लाभ|ಯೋಜನೆ|ಯೋಜನೆಗಳು|ಸರ್ಕಾರಿ/i],
  ['CROP_DISEASE', /\b(disease|sick|yellow leaves?|leaves?\s+(?:turning|are turning|going)|spots?|pest|infection|symptoms?)\b|रोग|बीमारी|पीले पत्ते|पीले हैं|पत्तियां|पत्ते पीले|कीड़े|दाग|ರೋಗ|ಹಳದಿ|ಎಲೆ|ಕೀಟ|ಕಲೆ/i],
  ['IRRIGATION_ADVICE', /\b(irrigat\w*|when (should|do) i water|watering advice|water my crop)\b|सिंचाई|फसल को पानी|पानी कब|ನೀರಾವರಿ|ನೀರು ಹಾಕ|ನೀರು ಯಾವಾಗ/i],
  ['SOIL_ADVICE', /\b(soil|soil type|soil test|soil health|ph level)\b|मिट्टी|मृदा|मिट्टी की जांच|मಣ್ಣ|ಮಣ್ಣು|ಪಿಎಚ್/i],
  ['CROP_RECOMMENDATION', /\b(which|what|recommend|suggest|choose).{0,35}\b(crop|grow|plant|sow)\b|\b(crop|grow|plant|sow).{0,35}\b(which|what|recommend|suggest)\b|कौन सी फसल|कौनसी फसल|क्या उगाऊं|फसल सुझाव|फसल की सलाह|ಯಾವ ಬೆಳೆ|ಬೆಳೆ ಆಯ್ಕೆ|ಯಾವುದನ್ನು ಬೆಳೆಯ|ಬೆಳೆ ಶಿಫಾರಸು/i],
  ['GENERAL_FARMING_QUESTION', /\b(farm|farming|farmer|crop|seed|fertilizer|harvest|pest|agriculture)\b|खेती|किसान|फसल|बीज|खाद|कटाई|कृषि|ಕೃಷಿ|ರೈತ|ಬೆಳೆ|ಬೀಜ|ಗೊಬ್ಬರ|ಕೊಯ್ಲು/i]
];

export function detectIntent(message) {
  const text = String(message || '').normalize('NFKC').trim();
  if (!text) return 'UNKNOWN_INTENT';
  return intentRules.find(([, pattern]) => pattern.test(text))?.[0] || 'UNKNOWN_INTENT';
}
