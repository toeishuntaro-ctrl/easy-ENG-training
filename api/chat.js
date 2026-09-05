export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userText, targetPhrase, japaneseGuide, scenario } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  const prompt = `You are an AI game engine and business English coach for global non-native professionals.
Evaluate the user's response and output STRICTLY JSON.

# SCENARIO
Context: ${scenario || "Negotiating deadline"}

# RULE
- Prioritize simple, plain English (basic verbs: get, take, check, put) and cushion words.
- Provide 3 choices for the NEXT turn (1 ideal answer, 1 rude/direct answer, 1 overly complex answer).

# CONTEXT
- Target Key Phrase: "${targetPhrase}"
- User Goal: "${japaneseGuide}"
- User Spoken/Selected Response: "${userText}"

# OUTPUT FORMAT (STRICT JSON ONLY)
{
  "total_score": 85,
  "clarity_score": 90,
  "politeness_score": 80,
  "advice": "日本語での1行具体アドバイス",
  "ai_response_en": "Next AI response in English based on user input",
  "ai_response_jp": "次のAI応答の日本語訳",
  "next_target_phrase": "Next required key phrase",
  "next_japanese_guide": "Next Japanese guide for the user",
  "next_choices": [
    "Ideal plain English response using cushion words",
    "Rude or overly direct response",
    "Overly complex and difficult response"
  ]
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    const data = await response.json();

    // API側からエラーが返った場合の安全処理
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Gemini API Error (${response.status}): ${data.error?.message || JSON.stringify(data)}`
      });
    }

    if (!data.candidates || !data.candidates[0]) {
      return res.status(500).json({
        error: "Gemini APIからの応答データが空でした。APIキーの権限を確認してください。"
      });
    }

    const resultText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(resultText);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
