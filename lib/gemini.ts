import { GoogleGenAI, Type } from '@google/genai';
import type { HealthAssessment } from '@/types/telemetry';

const MODEL = 'gemini-2.5-flash';
const CACHE_TTL_SECONDS = 3600;

/**
 * Static system prompt, specialized for this project's fixed monitoring setup
 * (maize + common bean seedlings in two containers). Kept deliberately
 * detailed: it doubles as the domain knowledge for the model AND is large
 * enough to qualify for Gemini explicit context caching (>= 1,024 tokens),
 * so repeat requests only pay for the telemetry line and the image.
 */
export const SYSTEM_PROMPT = `You are an expert agronomist and plant pathologist AI embedded in an IoT plant health monitoring system.

CONTEXT — WHAT YOU WILL ALWAYS SEE
Every image you receive comes from the same fixed monitoring setup: two small plastic containers filled with dark potting soil, photographed from above or at a slight angle, together holding exactly four plants — two young maize (Zea mays) seedlings and two common bean (Phaseolus vulgaris) seedlings. The maize seedlings are the tall, narrow, strap-like grass leaves; the beans are the shorter plants with broad oval or heart-shaped (often trifoliate) leaves. The containers sit indoors or under shelter, so lighting in the photo may be uneven, dim, or flash-lit — account for white balance and shadows before judging leaf colour. Ignore the background (table, wall, paper, stakes): assess only the plants and the visible soil surface.

Every request also includes environmental telemetry captured at the same moment: soil moisture (volumetric %), air temperature (°C), and relative humidity (%). Always cross-reference what you see against these numbers.

YOUR TASK
Produce one combined health assessment for the maize and bean seedlings together, plus a separate score for each crop: maize_score covering the two maize seedlings and beans_score covering the two bean seedlings. When one crop looks worse than the other, say so explicitly in the diagnosis and weight the overall score toward the worst credible problem, not the average.

MAIZE (Zea mays) — WHAT TO CHECK
- Healthy baseline: upright habit, uniform medium-to-dark green blades, new leaves emerging from the whorl.
- Uniform pale green/yellowing starting on OLDER (lower) leaves, often in a V down the midrib: nitrogen deficiency.
- Yellow/white striping BETWEEN veins on younger leaves: magnesium, zinc or iron deficiency.
- Purple or reddish tint on leaves/stems of young plants: phosphorus deficiency (worse in cool soil).
- Scorched, brown leaf margins ("firing") on older leaves: potassium deficiency or salt stress.
- Leaves rolled inward along their length during the day: drought stress — check soil moisture.
- Small rust-orange powdery pustules in rows: common rust. Long grey-tan rectangular lesions between veins: grey leaf spot. Broken yellow streaking along veins of young leaves: maize streak virus.
- Pale, stretched, floppy seedlings leaning toward the light source: insufficient light (etiolation).

BEANS (Phaseolus vulgaris) — WHAT TO CHECK
- Healthy baseline: firm upright stems, flat broad leaves with even green colour, new trifoliate leaves unfolding.
- Interveinal chlorosis on YOUNG leaves: iron or zinc deficiency. On OLDER leaves: magnesium or nitrogen.
- Dark brown, sunken, angular lesions on stems, petioles or leaf veins: anthracnose.
- Water-soaked spots that dry papery-brown with a yellow halo: common bacterial blight.
- Mottled light/dark green mosaic with puckered, downward-curling leaves: bean common mosaic virus.
- Rust-brown circular pustules on the underside of leaves: bean rust.
- Whole-plant wilting while the soil is clearly moist: root rot or damping-off from overwatering — a serious finding in container seedlings.
- Scorched leaf edges: potassium deficiency or fertilizer burn.

PESTS (BOTH CROPS)
Look for clusters of tiny insects on stems and leaf undersides (aphids), fine webbing with stippled pale dots (spider mites), winding pale tunnels inside leaves (leaf miners), and ragged chewed holes or frass in maize whorls (armyworm/borers). Name the pest when visible.

WATER BALANCE — CROSS-CHECK TELEMETRY
- Target band for container seedlings is roughly 40–70% soil moisture.
- Below ~35%, especially with rolled maize leaves or drooping beans: underwatering — recommend watering now.
- Above ~75% sustained, especially with yellowing lower leaves, green algae or persistent sheen on the soil: overwatering and root-rot risk — recommend holding water and improving drainage.
- Dry, cracked or crusted soil surface visible in the image supports underwatering even if the sensor reads mid-range (sensors sit at root depth).

ENVIRONMENT RANGES
- Maize grows best at 21–30°C; beans at 18–27°C. Below ~15°C growth stalls and phosphorus uptake suffers; above ~35°C expect heat stress and wilting regardless of moisture.
- 50–70% relative humidity is comfortable. Persistently above ~80% favours fungal and bacterial disease — weight any lesions you see more heavily. Below ~35% increases transpiration stress on beans.

SCORING RUBRIC
- 90–100 (Healthy): vigorous, uniform colour, no disease or pest signs, telemetry in range.
- 70–89 (Healthy): minor cosmetic flaws only (slight lower-leaf fade, one damaged leaf), nothing needing urgent action.
- 40–69 (Warning): clear deficiency, stress or early disease indicators that need action within days (e.g. nitrogen chlorosis, drought curling, first pustules, mild overcrowding).
- 20–39 (Critical): spreading disease, severe deficiency or severe water imbalance; act immediately.
- 0–19 (Critical): plants collapsing or largely necrotic.
Status mapping: score >= 70 → "Healthy"; 40–69 → "Warning"; < 40 → "Critical".

OUTPUT CONTRACT
Respond with STRICTLY VALID JSON and nothing else — no markdown fences, no commentary, no trailing text:
{
  "health_score": <integer 0-100, overall>,
  "maize_score": <integer 0-100, the two maize seedlings>,
  "beans_score": <integer 0-100, the two bean seedlings>,
  "status": "Healthy" | "Warning" | "Critical",
  "diagnosis": "<2-6 sentences naming which crop(s) are affected, the symptoms observed, the most likely cause, and how the telemetry supports it>",
  "recommended_actions": ["<3-6 concrete, prioritized actions a home grower can take, most urgent first>"]
}
If the image is unusable (too dark, blurred, or does not show the plants), still return valid JSON: use status "Warning", a diagnosis explaining the capture problem, and recommended actions that ask for a better image.`;

interface TelemetryContext {
  temperature: number;
  humidity: number;
  soilMoisture: number;
}

/** Recent records passed back to the model for temporal consistency. */
export interface AssessmentHistoryEntry {
  timestamp: Date | string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  healthScore?: number;
  status?: string;
  diagnosis?: string;
}

/**
 * Structured-output contract: Gemini is forced to return exactly this JSON
 * shape (integer score, status enum), eliminating free-text parse failures.
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    health_score: {
      type: Type.INTEGER,
      description: 'Overall health of the maize and bean seedlings, 0-100',
    },
    maize_score: {
      type: Type.INTEGER,
      description: 'Health of the two maize seedlings, 0-100',
    },
    beans_score: {
      type: Type.INTEGER,
      description: 'Health of the two bean seedlings, 0-100',
    },
    status: {
      type: Type.STRING,
      enum: ['Healthy', 'Warning', 'Critical'],
    },
    diagnosis: { type: Type.STRING },
    recommended_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'health_score',
    'maize_score',
    'beans_score',
    'status',
    'diagnosis',
    'recommended_actions',
  ],
};

function formatHistory(history: AssessmentHistoryEntry[]): string {
  if (history.length === 0) return '';

  const chronological = [...history].reverse();
  const lines = chronological.map((h) => {
    const when = new Date(h.timestamp).toLocaleString();
    const assessed =
      typeof h.healthScore === 'number'
        ? ` — scored ${h.healthScore} (${h.status ?? 'n/a'})`
        : ' — not assessed';
    return `- [${when}] ${h.temperature}°C, ${h.humidity}% RH, ${h.soilMoisture}% soil${assessed}`;
  });

  const previous = history.find(
    (h) => typeof h.healthScore === 'number' && h.diagnosis
  );
  const previousBlock = previous
    ? `\nMost recent diagnosis (${new Date(previous.timestamp).toLocaleString()}, ${previous.healthScore}/100 ${previous.status}): ${String(previous.diagnosis).slice(0, 400)}`
    : '';

  return `RECENT HISTORY (oldest first):\n${lines.join('\n')}${previousBlock}\n\n`;
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Explicit context cache for the system prompt (per server instance).
 * Recreated when missing or within a minute of expiry; any failure falls
 * back to sending the system instruction inline.
 */
let promptCache: { name: string; expiresAt: number } | null = null;

async function getSystemPromptCache(genAI: GoogleGenAI): Promise<string | null> {
  if (promptCache && Date.now() < promptCache.expiresAt - 60_000) {
    return promptCache.name;
  }
  try {
    const created = await genAI.caches.create({
      model: MODEL,
      config: {
        displayName: 'phms-maize-beans-system-prompt',
        systemInstruction: SYSTEM_PROMPT,
        ttl: `${CACHE_TTL_SECONDS}s`,
      },
    });
    if (!created.name) return null;
    promptCache = {
      name: created.name,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    };
    console.log('Created Gemini context cache for system prompt:', created.name);
    return promptCache.name;
  } catch (e) {
    console.warn(
      'Gemini context cache unavailable; sending system instruction inline.',
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

export function parseHealthAssessment(text: string): Partial<HealthAssessment> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const validScore = (v: unknown): v is number =>
      typeof v === 'number' && v >= 0 && v <= 100;

    if (
      validScore(parsed.health_score) &&
      ['Healthy', 'Warning', 'Critical'].includes(parsed.status)
    ) {
      return {
        health_score: parsed.health_score,
        maize_score: validScore(parsed.maize_score) ? parsed.maize_score : undefined,
        beans_score: validScore(parsed.beans_score) ? parsed.beans_score : undefined,
        status: parsed.status,
        diagnosis: typeof parsed.diagnosis === 'string' ? parsed.diagnosis : undefined,
        recommended_actions: Array.isArray(parsed.recommended_actions)
          ? parsed.recommended_actions.filter((a: unknown) => typeof a === 'string')
          : undefined,
      };
    }
  } catch {
    // fall through to empty assessment
  }
  return {};
}

export async function analyzePlantHealth(
  imageBuffer: Buffer,
  mimeType: string,
  telemetry: TelemetryContext,
  history: AssessmentHistoryEntry[] = []
): Promise<Partial<HealthAssessment>> {
  const genAI = getClient();

  const trendInstruction =
    history.length > 0
      ? ' Judge the CURRENT image in light of the history above: note whether conditions are improving, stable, or worsening, and keep your scores consistent with the previous assessments unless the image or telemetry justifies a change.'
      : '';

  const contents = [
    {
      text: `${formatHistory(history)}Environmental telemetry for this capture — Soil Moisture: ${telemetry.soilMoisture}%, Temperature: ${telemetry.temperature}°C, Humidity: ${telemetry.humidity}%. Analyze the attached image of the maize and bean seedlings and return the health assessment JSON.${trendInstruction}`,
    },
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg',
      },
    },
  ];

  // Structured output: the model must return the RESPONSE_SCHEMA JSON shape
  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };

  const cachedContent = await getSystemPromptCache(genAI);

  try {
    const result = await genAI.models.generateContent({
      model: MODEL,
      config: cachedContent
        ? { cachedContent, ...generationConfig }
        : { systemInstruction: SYSTEM_PROMPT, ...generationConfig },
      contents,
    });
    return parseHealthAssessment(result.text ?? '');
  } catch (e) {
    if (cachedContent) {
      // The cache may have expired or been evicted server-side — retry once inline
      promptCache = null;
      const result = await genAI.models.generateContent({
        model: MODEL,
        config: { systemInstruction: SYSTEM_PROMPT, ...generationConfig },
        contents,
      });
      return parseHealthAssessment(result.text ?? '');
    }
    throw e;
  }
}
