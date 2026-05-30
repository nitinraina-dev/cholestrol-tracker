import { File } from 'expo-file-system';

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── Key pool ────────────────────────────────────────────────────────────────
// Add up to 5 keys in your .env:
//   EXPO_PUBLIC_GEMINI_API_KEY=AIza...
//   EXPO_PUBLIC_GEMINI_API_KEY_2=AIza...
//   EXPO_PUBLIC_GEMINI_API_KEY_3=AIza...  (etc.)
const API_KEYS = [
  process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_2,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_3,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_4,
  process.env.EXPO_PUBLIC_GEMINI_API_KEY_5,
].filter(Boolean);

// Per-key cooldown end-timestamp (ms). 0 = available now.
const keyCooldowns = new Array(Math.max(API_KEYS.length, 1)).fill(0);
// Start key index rotates after each successful call for load distribution.
let rotationIndex = 0;

// ── Error types callers can detect ──────────────────────────────────────────
export class RateLimitError extends Error {
  constructor(waitMs) {
    super('rate_limit');
    this.name = 'RateLimitError';
    this.waitMs = waitMs; // ms until earliest key recovers
  }
}

export class DailyQuotaError extends Error {
  constructor() {
    super('daily_quota');
    this.name = 'DailyQuotaError';
  }
}

// ── Diet / language prompt helpers ──────────────────────────────────────────

const DIET_CONTEXT = {
  veg:      'DIET: Pure Vegetarian (no meat, no fish, no eggs). Only suggest plant-based alternatives.',
  nonveg:   'DIET: Non-Vegetarian (eats meat, fish, eggs). Can suggest lean meats and fish.',
  omnivore: 'DIET: Omnivore (balanced diet). Can suggest any food type in moderation.',
};

const LANGUAGE_INSTRUCTION = {
  english:   '',
  hinglish:  'LANGUAGE: Write all text fields in Hinglish — a natural mix of Hindi and English as spoken in everyday Indian conversation (e.g. "Yeh dish bahut healthy hai because isme fiber zyada hai"). Keep it casual and relatable.',
  hindi:     'LANGUAGE: Write all text fields in pure Hindi (Devanagari script). Example: "यह खाना आपके कोलेस्ट्रॉल के लिए अच्छा है।"',
  marathi:   'LANGUAGE: Write all text fields in Marathi (Devanagari script). Example: "हे जेवण तुमच्या कोलेस्टेरॉलसाठी चांगले आहे."',
  gujarati:  'LANGUAGE: Write all text fields in Gujarati script. Example: "આ ભોજન તમારા કોલેસ્ટ્રોલ માટે સારું છે."',
  bengali:   'LANGUAGE: Write all text fields in Bengali (Bangla script). Example: "এই খাবার আপনার কোলেস্টেরলের জন্য ভালো।"',
  tamil:     'LANGUAGE: Write all text fields in Tamil script. Example: "இந்த உணவு உங்கள் கொழுப்புக்கு நல்லது."',
  telugu:    'LANGUAGE: Write all text fields in Telugu script. Example: "ఈ ఆహారం మీ కొలెస్ట్రాల్‌కు మంచిది."',
  kannada:   'LANGUAGE: Write all text fields in Kannada script. Example: "ಈ ಆಹಾರ ನಿಮ್ಮ ಕೊಲೆಸ್ಟ್ರಾಲ್‌ಗೆ ಒಳ್ಳೆಯದು."',
  malayalam: 'LANGUAGE: Write all text fields in Malayalam script. Example: "ഈ ഭക്ഷണം നിങ്ങളുടെ കൊളസ്ട്രോളിന് നല്ലതാണ്."',
  punjabi:   'LANGUAGE: Write all text fields in Punjabi (Gurmukhi script). Example: "ਇਹ ਭੋਜਨ ਤੁਹਾਡੇ ਕੋਲੇਸਟ੍ਰੋਲ ਲਈ ਚੰਗਾ ਹੈ."',
};

function langInstruction(language = 'english') {
  const instr = LANGUAGE_INSTRUCTION[language];
  if (!instr) return '';
  return `\n${instr}\nIMPORTANT: Keep ALL JSON field names in English. Only translate the string values.`;
}

function buildFoodPrompt(report, dietPreference = 'omnivore', language = 'english') {
  const reportContext = report
    ? `PATIENT'S LATEST BLOOD REPORT (${new Date(report.date).toLocaleDateString('en-IN')}):
- Total Cholesterol: ${report.totalCholesterol ?? 'N/A'} mg/dL
- LDL: ${report.ldl ?? 'N/A'} mg/dL
- HDL: ${report.hdl ?? 'N/A'} mg/dL
- VLDL: ${report.vldl ?? 'N/A'} mg/dL
- Triglycerides: ${report.triglycerides ?? 'N/A'} mg/dL
Use these ACTUAL values to personalize the canEat verdict and personalizedAdvice.`
    : `No blood report on file. Assume HIGH VLDL, HIGH LDL, HIGH TRIGLYCERIDES as a precaution.`;

  const dietCtx = DIET_CONTEXT[dietPreference] || DIET_CONTEXT.omnivore;

  return `You are a clinical dietitian assistant.
${reportContext}
${dietCtx}

Analyze the food image. The image may show:
A) A prepared meal or fresh food — visually identify it and estimate nutrients.
B) A packaged/snack product — READ the ingredient list and nutrition facts panel printed on the pack. Use the actual label values for nutrients if visible. Flag harmful ingredients for cholesterol: palm oil, hydrogenated oil, partially hydrogenated fat, trans fat, vanaspati, refined flour (maida), high-fructose corn syrup, artificial cream.

For packaged items include the product name in the foods array. In servingNote mention the pack serving size if readable from the label.

Risk rules:
- HIGH riskLevel (riskScore 7-10): fried foods, red meat, full-fat dairy, butter, ghee, pastries, white rice/bread, sugary drinks, packaged snacks with trans fat or palm oil
- MEDIUM riskLevel (riskScore 4-6): chicken with skin, eggs, refined carbs, excess vegetable oils, most packaged biscuits/chips
- LOW riskLevel (riskScore 1-3): vegetables, fruits, legumes, whole grains, fish (if non-veg), nuts, olive oil, low-fat packaged items

canEat: YES=riskScore 1-3, IN MODERATION=4-6, AVOID=7-10 or worsens already-high values.
Prefer label values for nutrients; estimate if label is not visible. All values in grams (cholesterol in mg). Use 0 for omega3 if not applicable.
Estimate protein content in grams from ingredients/label. For a typical meal portion this is usually 5-40g.
personalizedAdvice should reference actual blood values if available.
${langInstruction(language)}`;
}

function buildSuggestionsPrompt(report, dietPreference = 'omnivore', language = 'english') {
  const reportContext = report
    ? `Blood report: LDL ${report.ldl ?? 'N/A'}, HDL ${report.hdl ?? 'N/A'}, VLDL ${report.vldl ?? 'N/A'}, TG ${report.triglycerides ?? 'N/A'} mg/dL.`
    : `Assume HIGH LDL, HIGH VLDL, HIGH TRIGLYCERIDES.`;

  const dietCtx = DIET_CONTEXT[dietPreference] || DIET_CONTEXT.omnivore;

  const seed = Math.floor(Math.random() * 1000);
  const mealTimes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const focus = mealTimes[seed % mealTimes.length];
  const regions = ['North Indian', 'South Indian', 'Gujarati', 'Bengali', 'Maharashtrian', 'Punjabi', 'Kerala'];
  const region = regions[seed % regions.length];

  return `You are a clinical dietitian and chef. ${reportContext} ${dietCtx}

Suggest 4 specific, realistic Indian meals that are SAFE for this patient to eat today. Each meal must have riskScore 1-3.
Vary the meal types — include a mix of ${focus} options and ${region} cuisine this time. Do NOT repeat meals from previous suggestions.
For each meal provide:
- Ingredients list with quantities (e.g. "1 cup moong dal", "2 tsp cumin seeds")
- Cooking instructions (3-4 clear steps)
- prepTime and cookTime in whole minutes
- servings count (typically 2-4)
- imageSearchQuery: a short English phrase (2-3 words) to find a food photo of this dish
- Estimated nutrient values in grams
${langInstruction(language)}`;
}

const REPORT_EXTRACT_PROMPT = `You are a medical data extraction assistant. Extract cholesterol values from this lab report (image or PDF). Use null for any value not found in the report, including the date.`;

// ── JSON schemas ─────────────────────────────────────────────────────────────

const FOOD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    foods:       { type: 'ARRAY', items: { type: 'STRING' } },
    servingNote: { type: 'STRING' },
    nutrients: {
      type: 'OBJECT',
      properties: {
        saturatedFat: { type: 'NUMBER' },
        transFat:     { type: 'NUMBER' },
        cholesterol:  { type: 'NUMBER' },
        totalCarbs:   { type: 'NUMBER' },
        sugar:        { type: 'NUMBER' },
        fiber:        { type: 'NUMBER' },
        omega3:       { type: 'NUMBER' },
        protein:      { type: 'NUMBER' },
      },
      required: ['saturatedFat', 'transFat', 'cholesterol', 'totalCarbs', 'sugar', 'fiber', 'omega3', 'protein'],
    },
    riskLevel:          { type: 'STRING' },
    riskScore:          { type: 'NUMBER' },
    canEat:             { type: 'STRING' },
    warnings:           { type: 'ARRAY', items: { type: 'STRING' } },
    benefits:           { type: 'ARRAY', items: { type: 'STRING' } },
    recommendation:     { type: 'STRING' },
    personalizedAdvice: { type: 'STRING' },
  },
  required: ['foods', 'servingNote', 'nutrients', 'riskLevel', 'riskScore', 'canEat', 'warnings', 'benefits', 'recommendation', 'personalizedAdvice'],
};

const SUGGESTIONS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name:             { type: 'STRING' },
      description:      { type: 'STRING' },
      riskScore:        { type: 'NUMBER' },
      prepTime:         { type: 'NUMBER' },
      cookTime:         { type: 'NUMBER' },
      servings:         { type: 'NUMBER' },
      ingredients:      { type: 'ARRAY', items: { type: 'STRING' } },
      steps:            { type: 'ARRAY', items: { type: 'STRING' } },
      nutrients: {
        type: 'OBJECT',
        properties: {
          fiber:        { type: 'NUMBER' },
          omega3:       { type: 'NUMBER' },
          saturatedFat: { type: 'NUMBER' },
        },
        required: ['fiber', 'omega3', 'saturatedFat'],
      },
      tip:              { type: 'STRING' },
      imageSearchQuery: { type: 'STRING' },
    },
    required: ['name', 'description', 'riskScore', 'prepTime', 'cookTime', 'servings', 'ingredients', 'steps', 'nutrients', 'tip', 'imageSearchQuery'],
  },
};

const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    totalCholesterol: { type: 'NUMBER', nullable: true },
    ldl:              { type: 'NUMBER', nullable: true },
    hdl:              { type: 'NUMBER', nullable: true },
    vldl:             { type: 'NUMBER', nullable: true },
    triglycerides:    { type: 'NUMBER', nullable: true },
    reportDate:       { type: 'STRING', nullable: true },
  },
  required: ['totalCholesterol', 'ldl', 'hdl', 'vldl', 'triglycerides', 'reportDate'],
};

// ── JSON sanitiser ───────────────────────────────────────────────────────────
// Escapes unescaped control characters that the model sometimes writes
// literally inside JSON strings, making JSON.parse fail.
function fixJsonStrings(raw) {
  let out = '';
  let inString = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      if (ch === '\\') {
        out += ch + (raw[i + 1] || '');
        i += 2;
        continue;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else {
        const code = raw.charCodeAt(i);
        if (code < 0x20) {
          if (ch === '\n') out += '\\n';
          else if (ch === '\r') out += '\\r';
          else if (ch === '\t') out += '\\t';
          else out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
          out += ch;
        }
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
    i++;
  }
  return out;
}

// ── Core API call with automatic key rotation ────────────────────────────────
async function callAI(parts, maxOutputTokens = 4096, schema = null, temperature = 0.1) {
  if (API_KEYS.length === 0) {
    console.error('[Gemini] No API keys found — check EXPO_PUBLIC_GEMINI_API_KEY in .env');
    throw new Error('AI service is not set up. Please contact support.');
  }
  console.log(`[Gemini] callAI — keys: ${API_KEYS.length}, parts: ${parts.length}, maxTokens: ${maxOutputTokens}, rotationIndex: ${rotationIndex}`);

  const generationConfig = { temperature, maxOutputTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
    // Disable thinking for structured output — thinking tokens count against maxOutputTokens
    // in gemini-2.5-flash, consuming most of the budget before the JSON response even starts.
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const body = JSON.stringify({ contents: [{ parts }], generationConfig });

  // Try each key once, starting from rotationIndex (round-robin).
  // On 429, mark that key as cooling and immediately try the next one.
  for (let offset = 0; offset < API_KEYS.length; offset++) {
    const i = (rotationIndex + offset) % API_KEYS.length;

    // Skip keys still in their cooldown window.
    if (Date.now() < keyCooldowns[i]) continue;

    const response = await fetch(`${API_URL}?key=${API_KEYS[i]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.status === 429) {
      const txt = await response.text();
      const perMinuteMatch = txt.match(/retry in ([\d.]+)s/i);
      if (perMinuteMatch) {
        // Per-minute quota: short cooldown, try next key immediately
        const waitSec = Math.ceil(parseFloat(perMinuteMatch[1]));
        keyCooldowns[i] = Date.now() + waitSec * 1000;
        console.warn(`[Gemini] Key ${i} per-minute limit — cooldown ${waitSec}s`);
      } else {
        // Daily quota (no "retry in Xs" in body) — cool down for 2h, no point retrying soon
        keyCooldowns[i] = Date.now() + 2 * 60 * 60 * 1000;
        console.warn(`[Gemini] Key ${i} daily quota exhausted. Body: ${txt.slice(0, 200)}`);
      }
      continue;
    }

    if (response.status >= 500) {
      // Server-side error (503 overloaded, 500 internal, etc.) — temporary, try next key
      const txt = await response.text();
      console.warn(`[Gemini] Key ${i} server error ${response.status} — trying next key. ${txt.slice(0, 150)}`);
      keyCooldowns[i] = Date.now() + 15 * 1000; // 15s cooldown then this key is usable again
      continue;
    }

    if (!response.ok) {
      const txt = await response.text();
      console.error(`[Gemini] Key ${i} HTTP ${response.status}: ${txt.slice(0, 300)}`);
      throw new Error(`HTTP_${response.status}`);
    }

    // Got a 200 — check the body is usable before committing this key as successful.
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn(`[Gemini] Key ${i} returned empty response — trying next key.`, JSON.stringify(data).slice(0, 200));
      keyCooldowns[i] = Date.now() + 5 * 1000;
      continue;
    }

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = fixJsonStrings(cleaned);

    // If caller expects JSON (schema provided), validate it parses before committing.
    if (schema) {
      try {
        JSON.parse(result);
      } catch (parseErr) {
        console.warn(`[Gemini] Key ${i} JSON parse failed (likely truncated) — trying next key. ${parseErr.message}. Preview: ${result.slice(-100)}`);
        keyCooldowns[i] = Date.now() + 5 * 1000;
        continue;
      }
    }

    // Success — advance rotation index so the next call starts on the next key.
    rotationIndex = (i + 1) % API_KEYS.length;
    return result;
  }

  // All keys exhausted this pass — check why.
  const now = Date.now();
  let earliest = Infinity;
  for (let i = 0; i < API_KEYS.length; i++) {
    if (keyCooldowns[i] > now && keyCooldowns[i] < earliest) {
      earliest = keyCooldowns[i];
    }
  }
  const waitMs = earliest === Infinity ? 60000 : Math.max(0, earliest - now);
  // If all keys are cooling for > 1 hour it's a daily quota situation, not per-minute
  if (waitMs > 60 * 60 * 1000) throw new DailyQuotaError();
  throw new RateLimitError(waitMs);
}

// ── Public exports ────────────────────────────────────────────────────────────

export async function analyzeFoodImage(imageUri, report = null, dietPreference = 'omnivore', language = 'english', textHint = '') {
  console.log('[Gemini] analyzeFoodImage: encoding', imageUri?.slice(-60));
  let base64;
  try {
    base64 = await new File(imageUri).base64();
    console.log('[Gemini] Image encoded OK, length:', base64?.length ?? 0);
  } catch (encErr) {
    console.error('[Gemini] Image encoding FAILED:', encErr?.message ?? encErr);
    throw encErr;
  }
  const lower = (imageUri || '').toLowerCase();
  const mimeType = lower.includes('.png') ? 'image/png'
    : lower.includes('.webp') ? 'image/webp'
    : lower.includes('.heic') || lower.includes('.heif') ? 'image/heic'
    : 'image/jpeg';
  console.log('[Gemini] Detected mime type:', mimeType);
  const hintPart = textHint.trim()
    ? `\nUSER NOTE: The user says this meal contains: "${textHint.trim()}". Use this to resolve any ambiguity in identifying the food (e.g. distinguish tofu from paneer, use exact item names the user provided).`
    : '';
  const text = await callAI([
    { text: buildFoodPrompt(report, dietPreference, language) + hintPart },
    { inline_data: { mime_type: mimeType, data: base64 } },
  ], 2048, FOOD_SCHEMA);
  return JSON.parse(text);
}

export async function analyzeTextMeal(description, report = null, dietPreference = 'omnivore', language = 'english') {
  const reportContext = report
    ? `PATIENT'S LATEST BLOOD REPORT (${new Date(report.date).toLocaleDateString('en-IN')}):
- Total Cholesterol: ${report.totalCholesterol ?? 'N/A'} mg/dL
- LDL: ${report.ldl ?? 'N/A'} mg/dL
- HDL: ${report.hdl ?? 'N/A'} mg/dL
- VLDL: ${report.vldl ?? 'N/A'} mg/dL
- Triglycerides: ${report.triglycerides ?? 'N/A'} mg/dL
Use these ACTUAL values to personalize the canEat verdict and personalizedAdvice.`
    : `No blood report on file. Assume HIGH VLDL, HIGH LDL, HIGH TRIGLYCERIDES as a precaution.`;

  const dietCtx = DIET_CONTEXT[dietPreference] || DIET_CONTEXT.omnivore;

  const prompt = `You are a clinical dietitian assistant.
${reportContext}
${dietCtx}

The user has described their meal in text. Analyze it for cholesterol and cardiovascular impact.

MEAL DESCRIPTION: "${description}"

Identify each food item mentioned, estimate realistic nutrient values for a typical serving of this meal. Apply the same risk rules:
- HIGH riskLevel (riskScore 7-10): fried foods, red meat, full-fat dairy, butter, ghee, pastries, white rice/bread, sugary drinks, packaged snacks with trans fat or palm oil
- MEDIUM riskLevel (riskScore 4-6): chicken with skin, eggs, refined carbs, excess vegetable oils
- LOW riskLevel (riskScore 1-3): vegetables, fruits, legumes, whole grains, fish (if non-veg), nuts, olive oil

canEat: YES=riskScore 1-3, IN MODERATION=4-6, AVOID=7-10 or worsens already-high values.
All nutrient values in grams (cholesterol in mg). Use 0 for omega3 if not applicable.
personalizedAdvice should reference actual blood values if available.
${langInstruction(language)}`;

  const text = await callAI([{ text: prompt }], 1024, FOOD_SCHEMA, 0.1);
  return JSON.parse(text);
}

export async function getMealSuggestions(report = null, dietPreference = 'omnivore', language = 'english') {
  const text = await callAI([{ text: buildSuggestionsPrompt(report, dietPreference, language) }], 4096, SUGGESTIONS_SCHEMA, 0.9);
  return JSON.parse(text);
}

export async function extractReportValues(fileUri, mimeType = 'image/jpeg') {
  const base64 = await new File(fileUri).base64();
  const text = await callAI([
    { text: REPORT_EXTRACT_PROMPT },
    { inline_data: { mime_type: mimeType, data: base64 } },
  ], 4096, REPORT_SCHEMA);
  return JSON.parse(text);
}

export async function recalculateMealScore(originalAnalysis, chatHistory, report = null, language = 'english') {
  const historyText = chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Dietitian'}: ${m.text}`).join('\n');
  const prompt = `You are a clinical dietitian. A meal was analyzed and the user provided additional context through conversation. Revise the analysis based on that context.

ORIGINAL ANALYSIS:
- Foods: ${originalAnalysis.foods?.join(', ')}
- Risk: ${originalAnalysis.riskLevel} (${originalAnalysis.riskScore}/10) — ${originalAnalysis.canEat}
- Nutrients: saturatedFat ${originalAnalysis.nutrients?.saturatedFat}g, transFat ${originalAnalysis.nutrients?.transFat}g, cholesterol ${originalAnalysis.nutrients?.cholesterol}mg, totalCarbs ${originalAnalysis.nutrients?.totalCarbs}g, sugar ${originalAnalysis.nutrients?.sugar}g, fiber ${originalAnalysis.nutrients?.fiber}g, omega3 ${originalAnalysis.nutrients?.omega3}g, protein ${originalAnalysis.nutrients?.protein}g
- servingNote: ${originalAnalysis.servingNote}
${report ? `- Blood report: LDL ${report.ldl ?? 'N/A'}, HDL ${report.hdl ?? 'N/A'}, VLDL ${report.vldl ?? 'N/A'}, TG ${report.triglycerides ?? 'N/A'} mg/dL` : ''}

CONVERSATION CONTEXT:
${historyText}

Update the analysis based on the conversation (e.g. portion size, cooking method, extra ingredients). If nothing meaningful changed, keep original values but freshen personalizedAdvice.
${langInstruction(language)}`;
  const text = await callAI([{ text: prompt }], 2048, FOOD_SCHEMA, 0.3);
  return JSON.parse(text);
}

export async function analyzeProductText(productName, brand, servingSize, nutriments, report = null, dietPreference = 'omnivore', language = 'english') {
  const reportContext = report
    ? `PATIENT'S BLOOD REPORT: LDL ${report.ldl ?? 'N/A'}, HDL ${report.hdl ?? 'N/A'}, VLDL ${report.vldl ?? 'N/A'}, TG ${report.triglycerides ?? 'N/A'} mg/dL.`
    : `No blood report. Assume HIGH LDL, HIGH VLDL, HIGH TRIGLYCERIDES.`;
  const dietCtx = DIET_CONTEXT[dietPreference] || DIET_CONTEXT.omnivore;

  const n = nutriments || {};
  const prompt = `You are a clinical dietitian assistant.
${reportContext}
${dietCtx}

Analyze this packaged food product:
Product: ${productName}${brand ? ` by ${brand}` : ''}
Serving size: ${servingSize || 'as labelled'}
Nutrition per serving:
- Saturated fat: ${n.saturatedFat ?? n['saturated-fat_serving'] ?? 'N/A'} g
- Trans fat: ${n.transFat ?? n['trans-fat_serving'] ?? 0} g
- Cholesterol: ${n.cholesterol ?? n['cholesterol_serving'] ?? 0} mg
- Total carbs: ${n.totalCarbs ?? n['carbohydrates_serving'] ?? 'N/A'} g
- Sugar: ${n.sugar ?? n['sugars_serving'] ?? 'N/A'} g
- Fiber: ${n.fiber ?? n['fiber_serving'] ?? n['fibers_serving'] ?? 0} g
- Protein: ${n.protein ?? n['proteins_serving'] ?? 'N/A'} g
- Omega-3: ${n.omega3 ?? 0} g

Apply the same risk rules:
HIGH (7-10): trans fat, palm oil products, high sugar, fried, vanaspati
MEDIUM (4-6): moderate saturated fat, refined carbs
LOW (1-3): high fiber, low sat fat, plant-based
${langInstruction(language)}`;

  const text = await callAI([{ text: prompt }], 2048, FOOD_SCHEMA, 0.1);
  return JSON.parse(text);
}

export async function chatAboutMeal(userMessage, history = [], mealAnalysis, report = null, language = 'english') {
  const recentHistory = history.slice(-6);
  const historyText = recentHistory.length
    ? recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Dietitian'}: ${m.text}`).join('\n') + '\n'
    : '';

  const prompt = `You are a clinical dietitian assistant. The user just scanned a meal.

MEAL ANALYSIS:
- Foods: ${mealAnalysis.foods?.join(', ')}
- Risk: ${mealAnalysis.riskLevel} (${mealAnalysis.riskScore}/10) — ${mealAnalysis.canEat}
- Saturated fat: ${mealAnalysis.nutrients?.saturatedFat}g, Cholesterol: ${mealAnalysis.nutrients?.cholesterol}mg, Fiber: ${mealAnalysis.nutrients?.fiber}g, Protein: ${mealAnalysis.nutrients?.protein}g
${mealAnalysis.warnings?.length ? '- Warnings: ' + mealAnalysis.warnings.join('; ') : ''}
${mealAnalysis.benefits?.length ? '- Benefits: ' + mealAnalysis.benefits.join('; ') : ''}
${report ? `- Patient blood report: LDL ${report.ldl ?? 'N/A'}, HDL ${report.hdl ?? 'N/A'}, VLDL ${report.vldl ?? 'N/A'}, TG ${report.triglycerides ?? 'N/A'} mg/dL` : ''}

Answer the user's question about this meal in 3-5 sentences. Focus on cholesterol and nutrition impact. Do not cut your response short — always complete your thought.
${langInstruction(language)}

${historyText}User: ${userMessage}
Dietitian:`;

  return (await callAI([{ text: prompt }], 2048, null, 0.7)).trim();
}
