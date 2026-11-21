import { fetchJson, HttpError } from '../utils/http.js';

const languageNames = { en: 'English', hi: 'Hindi', kn: 'Kannada' };

function profileSummary(farmer) {
  const soil = farmer.soil || {};
  const suppliedSoil = Object.entries({ type: soil.type, nitrogen: soil.nitrogen, phosphorus: soil.phosphorus, potassium: soil.potassium, pH: soil.ph }).filter(([, value]) => value !== '' && value !== undefined && value !== null);
  return {
    name: farmer.name,
    location: [farmer.village, farmer.district, farmer.state].filter(Boolean).join(', ') || 'not provided',
    preferredLanguage: languageNames[farmer.preferredLanguage] || 'English',
    farmSizeAcres: farmer.farmSize ?? 'not provided',
    soil: Object.fromEntries(suppliedSoil),
    irrigationFacilities: farmer.irrigationFacilities?.length ? farmer.irrigationFacilities : 'not provided',
    currentCrops: farmer.currentCrops?.length ? farmer.currentCrops : 'not provided'
  };
}

export async function askGroq({ farmer, task, prompt, image }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpError(503, 'AI advice is not configured yet. Add GROQ_API_KEY on the server to enable it.');

  const model = image
    ? process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'
    : process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const system = `You are a careful agricultural information assistant for Indian farmers. Reply in ${languageNames[farmer.preferredLanguage] || 'English'}. Keep the answer clear, short, practical, and easy to understand. Use headings and bullets where useful.\nFarmer context (missing values are not known; never infer measurements): ${JSON.stringify(profileSummary(farmer))}\nTask: ${task}\nSafety: distinguish supplied facts from estimates and general guidance; state uncertainty; do not invent live weather, market prices, soil measurements, official schemes, or local facts; do not give unsupported pesticide mixtures or dosages. For serious disease concerns, advise contacting a local agriculture officer or Krishi Vigyan Kendra. Mention when current local expert or official data is needed.`;
  const userContent = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}` } }
      ]
    : prompt;

  try {
    const result = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_completion_tokens: 900
      })
    });
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new HttpError(502, 'The AI service did not return an answer. Please try again.');
    return { answer, source: 'Groq AI', generatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'The AI service is temporarily unavailable. Please try again later.');
  }
}
