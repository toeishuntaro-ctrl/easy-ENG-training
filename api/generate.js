export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const prompt = `You are a business English game engine for global non-native professionals.
Generate a set of 5 different roleplay stages for a 15-minute daily practice session.
Output STRICTLY JSON with no extra text or markdown wrappers.

# RULES FOR GENERATION
- Target: Non-native business professionals working in global teams.
- Use simple, plain English (basic verbs: get, take, check, put) and cushion phrases.
- Each stage must have 3 choices (1 ideal plain English answer, 1 rude answer, 1 overly complex answer).

# JSON OUTPUT STRUCTURE
[
  {
    "stage": 1,
    "scenario_title": "1. 納期交渉 (Rajesh)",
    "ai_name": "Rajesh (Tech Lead)",
    "ai_en": "Tomorrow's deployment is completely impossible. My team is packed.",
    "ai_jp": "明日までの対応は完全に不可能です。チームは手一杯です。",
    "guide": "（相手の話を受け止めつつ否定する）おっしゃることは分かりますが、締切は金曜です",
    "target": "★ I totally see your point, but ...",
    "choices": [
      { "text": "I totally see your point, but the deadline is Friday.", "isCorrect": true, "score": 100, "advice": "完璧です！相手を尊重しつつ期限を伝えられました。" },
      { "text": "No, you must finish this tomorrow without excuse.", "isCorrect": false, "score": 30, "advice": "攻撃的な印象を与えてしまいます。" },
      { "text": "We ought to renegotiate the scheduling architecture.", "isCorrect": false, "score": 60, "advice": "単語が硬すぎます。簡単な言葉を使いましょう。" }
    ]
  }
] (Generate exactly 5 stages)
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
    const resultText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(resultText);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}