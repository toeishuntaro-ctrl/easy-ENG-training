import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userText, targetPhrase, japaneseGuide, scenario } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const prompt = `You are an AI game engine and business English coach for global non-native professionals.
Evaluate the user's response and output structured JSON.

# SCENARIO
Context: ${scenario || "Negotiating deadline and priorities"}

# RULE
- Prioritize simple, plain English (basic verbs: get, take, check, put) and cushion words.
- Provide 3 choices for the NEXT turn (1 ideal answer, 1 rude/direct answer, 1 overly complex answer).

# CONTEXT
- Target Key Phrase: "${targetPhrase || ''}"
- User Goal: "${japaneseGuide || ''}"
- User Spoken/Selected Response: "${userText || ''}"
`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      total_score: { type: Type.INTEGER, description: "Score from 0 to 100" },
      clarity_score: { type: Type.INTEGER, description: "Clarity score from 0 to 100" },
      politeness_score: { type: Type.INTEGER, description: "Politeness score from 0 to 100" },
      advice: { type: Type.STRING, description: "1-sentence Japanese practical feedback" },
      ai_response_en: { type: Type.STRING, description: "Next AI response in English based on user input" },
      ai_response_jp: { type: Type.STRING, description: "Japanese translation of next AI response" },
      next_target_phrase: { type: Type.STRING, description: "Next required Plain English key phrase" },
      next_japanese_guide: { type: Type.STRING, description: "Next Japanese guide for the user" },
      next_choices: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 choices for the next turn: [Ideal plain English, Rude/direct, Overly complex]"
      }
    },
    required: [
      "total_score", "clarity_score", "politeness_score", "advice",
      "ai_response_en", "ai_response_jp", "next_target_phrase", "next_japanese_guide", "next_choices"
    ]
  };

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const parsed = JSON.parse(response.text);
      return res.status(200).json(parsed);
    } catch (e) {
      lastError = e;
      console.warn(`[Chat Handler] Error with ${model}:`, e.message);
    }
  }

  return res.status(500).json({ error: lastError?.message || 'Chat generation failed.' });
}
