export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userText, targetPhrase, japaneseGuide } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  const prompt = `
You are an AI game engine and business English coach for global non-native professionals.
Evaluate the user's response and output STRICTLY JSON.

# RULE
- Prioritize simple, plain English (basic verbs: get, take, check, put) and cushion words.
- Give a quick, encouraging evaluation.

# CONTEXT
- Target Key Phrase: "${targetPhrase}"
- User Goal (Japanese Guide): "${japaneseGuide}"
- User Spoken Response: "${userText}"

# OUTPUT FORMAT (STRICT JSON ONLY)
{
  "total_score": 85,
  "advice": "日本語での1行具体アドバイス（例：基本動詞getを使ってシンプルに伝えられています）",
  "ai_response_en": "Next AI response in English based on user response",
  "ai_response_jp": "次のAI応答の日本語訳",
  "next_target_phrase": "Next required key phrase",
  "next_japanese_guide": "Next Japanese guide for the user"
}
`;

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!apiRes.ok) {
      const errData = await apiRes.text();
      return res.status(apiRes.status).json({ error: errData });
    }

    const data = await apiRes.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const resultJson = JSON.parse(resultText);

    return res.status(200).json(resultJson);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}