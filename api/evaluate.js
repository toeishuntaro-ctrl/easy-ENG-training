import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userInput, targetPhrase, keyPattern, context } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  if (!userInput || !userInput.trim()) {
    return res.status(400).json({ error: 'userInput is required.' });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const prompt = `You are an expert Plain English Business Coach evaluating a Japanese non-native professional's response in a high-stakes global business situation.

[Context]
- Scenario / Counterpart message: "${context || 'Discussing business deadlines and priorities'}"
- Taught Key Pattern (型): "${keyPattern || 'Plain English diplomatic response'}"
- Model Target Sentence: "${targetPhrase || ''}"
- User Free Input (typed or spoken): "${userInput.trim()}"

[Evaluation Criteria]
1. Clarity & Plain English (0-100): Is it simple, direct, free of unnecessary jargon, and using effective junior-high verbs (get, take, make, check, keep, put)?
2. Diplomacy & Politeness (0-100): Does it preserve trust, avoid being aggressively rude, and set clear expectations?
3. Pass/Fail Decision:
   - "EXCELLENT" if 80+, clear and natural Plain English.
   - "GOOD" if 60-79, understandable with minor stiffness or wordiness.
   - "NEEDS_IMPROVEMENT" if under 60, confusing, blunt, or misses the objective.
4. Better Plain English Alternative: How to rephrase the user's thought into an even sharper, concise Plain English sentence using basic verbs.
5. Practical 1-2 sentence advice in friendly Japanese.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        enum: ["EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT"],
        description: "Overall evaluation tier"
      },
      clarity_score: { type: Type.INTEGER, description: "Clarity score from 0 to 100" },
      politeness_score: { type: Type.INTEGER, description: "Politeness score from 0 to 100" },
      feedback_jp: { type: Type.STRING, description: "1-2 sentence constructive advice in Japanese" },
      improved_plain_en: { type: Type.STRING, description: "The best Plain English version of what the user tried to say" },
      highlights: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key strengths or points to tweak (e.g. ['基本動詞 check が上手に使えています', '前半にクッションを入れるとより好印象です'])"
      }
    },
    required: ["status", "clarity_score", "politeness_score", "feedback_jp", "improved_plain_en", "highlights"]
  };

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: "You are an encouraging, expert Global Plain English coach for non-native business professionals.",
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const parsed = JSON.parse(response.text);
      return res.status(200).json(parsed);
    } catch (e) {
      lastError = e;
      console.warn(`[Evaluate Handler] Error with ${model}:`, e.message);
    }
  }

  return res.status(500).json({ error: lastError?.message || 'Evaluation failed.' });
}
