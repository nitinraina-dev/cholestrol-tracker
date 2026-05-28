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

// ── Error type callers can detect to show a countdown ───────────────────────
export class RateLimitError extends Error {
  constructor(waitMs) {
    super('rate_limit');
    this.name = 'RateLimitError';
    this.waitMs = waitMs; // ms until earliest key recovers
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

Suggest 6 specific, realistic Indian meals that are SAFE for this patient to eat today. Each meal must have riskScore 1-3.
Vary the meal types — include a mix of ${focus} options and ${region} cuisine this time. Do NOT repeat meals from previous suggestions.
For each meal provide:
- Complete ingredients list with quantities (e.g. "1 cup moong dal", "2 tsp cumin seeds")
- Step-by-step cooking instructions (4-6 clear steps)
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
    throw new Error('AI service is not set up. Please contact support.');
  }

  const generationConfig = { temperature, maxOutputTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
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
      const match = txt.match(/retry in ([\d.]+)s/i);
      const waitSec = match ? Math.ceil(parseFloat(match[1])) : 60;
      keyCooldowns[i] = Date.now() + waitSec * 1000;
      continue; // silently move to the next key
    }

    if (!response.ok) {
      // Non-rate-limit error — don't expose internal details to the user.
      throw new Error('Something went wrong. Please try again.');
    }

    // Success — advance rotation index so the next call starts on the next key.
    rotationIndex = (i + 1) % API_KEYS.length;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Please try again.');

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return fixJsonStrings(cleaned);
  }

  // All keys are either cooling down or just exhausted this pass.
  // Tell the caller how long until the earliest key recovers.
  const now = Date.now();
  let earliest = Infinity;
  for (let i = 0; i < API_KEYS.length; i++) {
    if (keyCooldowns[i] > now && keyCooldowns[i] < earliest) {
      earliest = keyCooldowns[i];
    }
  }
  throw new RateLimitError(earliest === Infinity ? 60000 : Math.max(0, earliest - now));
}

// ── Public exports ────────────────────────────────────────────────────────────

export async function analyzeFoodImage(imageUri, report = null, dietPreference = 'omnivore', language = 'english') {
  const base64 = await new File(imageUri).base64();
  const text = await callAI([
    { text: buildFoodPrompt(report, dietPreference, language) },
    { inline_data: { mime_type: 'image/jpeg', data: base64 } },
  ], 4096, FOOD_SCHEMA);
  return JSON.parse(text);
}

export async function getMealSuggestions(report = null, dietPreference = 'omnivore', language = 'english') {
  const text = await callAI([{ text: buildSuggestionsPrompt(report, dietPreference, language) }], 8192, SUGGESTIONS_SCHEMA, 0.9);
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

export async function chatAboutMeal(userMessage, history = [], mealAnalysis, report = null, language = 'english') {
  const historyText = history.length
    ? history.map(m => `${m.role === 'user' ? 'User' : 'Dietitian'}: ${m.text}`).join('\n') + '\n'
    : '';

  const prompt = `You are a clinical dietitian assistant. The user just scanned a meal.

MEAL ANALYSIS:
- Foods: ${mealAnalysis.foods?.join(', ')}
- Risk: ${mealAnalysis.riskLevel} (${mealAnalysis.riskScore}/10) — ${mealAnalysis.canEat}
- Saturated fat: ${mealAnalysis.nutrients?.saturatedFat}g, Cholesterol: ${mealAnalysis.nutrients?.cholesterol}mg, Fiber: ${mealAnalysis.nutrients?.fiber}g, Protein: ${mealAnalysis.nutrients?.protein}g
${mealAnalysis.warnings?.length ? '- Warnings: ' + mealAnalysis.warnings.join('; ') : ''}
${mealAnalysis.benefits?.length ? '- Benefits: ' + mealAnalysis.benefits.join('; ') : ''}
${report ? `- Patient blood report: LDL ${report.ldl ?? 'N/A'}, HDL ${report.hdl ?? 'N/A'}, VLDL ${report.vldl ?? 'N/A'}, TG ${report.triglycerides ?? 'N/A'} mg/dL` : ''}

Answer the user's question about this meal concisely (2-4 sentences max). Focus on cholesterol and nutrition impact.
${langInstruction(language)}

${historyText}User: ${userMessage}
Dietitian:`;

  return (await callAI([{ text: prompt }], 512, null, 0.7)).trim();
}
