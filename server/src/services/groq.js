import { fetchJson, HttpError } from '../utils/http.js';
import { getLanguageDefinition } from '../config/languages.js';

const responseScriptPatterns = {
  Latin: /[A-Za-z]/,
  Bengali: /[\u0980-\u09FF]/,
  Devanagari: /[\u0900-\u097F]/,
  Gujarati: /[\u0A80-\u0AFF]/,
  Gurmukhi: /[\u0A00-\u0A7F]/,
  Kannada: /[\u0C80-\u0CFF]/,
  Arabic: /[\u0600-\u06FF\u0750-\u08FF]/,
  Malayalam: /[\u0D00-\u0D7F]/,
  Meetei_Mayek: /[\uABC0-\uABFF]/,
  Odia: /[\u0B00-\u0B7F]/,
  Ol_Chiki: /[\u1C50-\u1C7F]/,
  Tamil: /[\u0B80-\u0BFF]/,
  Telugu: /[\u0C00-\u0C7F]/
};

function profileSummary(farmer) {
  const soil = farmer.soil || {};
  const suppliedSoil = Object.entries({
    type: soil.type, nitrogen: soil.nitrogen, phosphorus: soil.phosphorus, potassium: soil.potassium,
    pH: soil.ph, moisturePercent: soil.moisturePct, moistureMeasuredAt: soil.moistureMeasuredAt
  }).filter(([, value]) => value !== '' && value !== undefined && value !== null);
  return {
    name: farmer.name,
    location: [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ') || 'not provided',
    preferredLanguage: getLanguageDefinition(farmer.preferredLanguage).englishName,
    farmSizeAcres: farmer.farmSize ?? 'not provided',
    soil: Object.fromEntries(suppliedSoil),
    cropPlan: farmer.farmPlan || {},
    irrigationFacilities: farmer.irrigationFacilities?.length ? farmer.irrigationFacilities : 'not provided',
    currentCrops: farmer.currentCrops?.length ? farmer.currentCrops : 'not provided'
  };
}

export async function askGroq({ farmer, task, prompt, image }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpError(503, 'AI advice is not configured yet. Add GROQ_API_KEY on the server to enable it.');

  const language = getLanguageDefinition(farmer.preferredLanguage);
  const model = image
    ? process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'
    : process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const system = `You are a careful agricultural information assistant for Indian farmers. Reply only in ${language.englishName} (${language.nativeName}); keep the same language in follow-up answers. Use simple, farmer-friendly wording and explain technical farming terms. Preserve crop names, numbers, dates, prices, quantities, units, and measurements exactly; do not translate or alter their values. Do not switch to Hindi or English unless the farmer asks. Keep the answer clear, short, practical, and easy to understand. Use headings and bullets where useful.\nFarmer context (missing values are not known; never infer measurements): ${JSON.stringify(profileSummary(farmer))}\nTask: ${task}\nSafety: distinguish supplied facts from estimates and general guidance; state uncertainty; do not invent live weather, market prices, soil measurements, official schemes, or local facts; do not give unsupported pesticide mixtures or dosages. For serious disease concerns, advise contacting a local agriculture officer or Krishi Vigyan Kendra. Mention when current local expert or official data is needed.`;
  const userContent = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}` } }
      ]
    : prompt;

  try {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ];
    let result = await requestCompletion(apiKey, model, messages);
    let answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new HttpError(502, 'The AI service did not return an answer. Please try again.');

    const expectedScript = responseScriptPatterns[language.script];
    if (expectedScript && !expectedScript.test(answer)) {
      result = await requestCompletion(apiKey, model, [
        ...messages,
        { role: 'assistant', content: answer },
        { role: 'user', content: `Rewrite your previous answer in ${language.englishName} (${language.nativeName}) using its usual writing system. Keep every factual value unchanged and do not add facts.` }
      ]);
      answer = result.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new HttpError(502, 'The AI service did not return an answer. Please try again.');
      if (expectedScript && !expectedScript.test(answer)) {
        throw new HttpError(502, `The AI service could not answer in ${language.nativeName}. Please try again later.`);
      }
    }

    return { answer, source: 'Groq AI', generatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'The AI service is temporarily unavailable. Please try again later.');
  }
}

export async function localizeAssistantText(farmer, text) {
  if (['en', 'hi', 'kn'].includes(farmer.preferredLanguage)) return text;
  const result = await askGroq({
    farmer,
    task: 'Translate one fixed Farmer Saathi message.',
    prompt: `Translate the following assistant message into ${getLanguageDefinition(farmer.preferredLanguage).englishName}. Do not add advice, facts, or commentary. Preserve names, numbers, dates, prices, quantities, units, and meaning exactly.\n\nMessage: ${JSON.stringify(text)}`
  });
  return result.answer;
}

async function requestCompletion(apiKey, model, messages) {
  return fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_completion_tokens: 900
    })
  });
}
