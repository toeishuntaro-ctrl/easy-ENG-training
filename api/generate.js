export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  
  // フロントエンドから送信されたトレーニングモード (quiz / sim) を取得
  const { mode = 'quiz' } = req.body || {};

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  // モードごとに生成するシナリオの専門性を制御
  const simInstruction = mode === 'sim'
    ? 'Focus specifically on Clinical Trial Management (CTM) scenarios involving Sponsor communications, CRA management, Site initiation delays, Protocol deviations, SAE reporting, and Vendor management.'
    : 'Focus on general Plain English business communication (negotiating deadlines, status updates, polite refusals, clarifying requests).';

  const prompt = `You are a business English game engine for global non-native professionals.
Generate a set of 5 different roleplay stages for a daily practice session.
Output STRICTLY JSON with no extra text or markdown wrappers.

# MODE SPECIFICITY
${simInstruction}

# RULES FOR GENERATION
- Target: Non-native business professionals working in global teams.
- Focus on Plain English: Basic verbs (get, take, check, put) and polite cushion phrases.
- Each stage must contain 3 choices with specific types:
  1. "PERFECT": Ideal plain English answer using cushion phrases and simple verbs.
  2. "TOO_COMPLEX": Grammatically correct, but uses overly complex, formal, or stiff vocabulary.
  3. "TOO_DIRECT": Clear, but lacks politeness, sounding blunt or aggressive.

# JSON OUTPUT STRUCTURE
[
  {
    "stage": 1,
    "scenario_title": "1. 進捗確認 (Elena)",
    "ai_name": "Elena (QA Lead)",
    "ai_en": "I'm still working on the test report. It's taking longer than expected.",
    "ai_jp": "まだテストレポートの作成中です。予想以上に時間がかかっています。",
    "guide": "（プレッシャーを与えずに聞く）急がなくて大丈夫ですが、いつ頃終わりそうか確認できますか？",
    "target": "No rush, but could you check when it will be done?",
    "choices": [
      { "type": "PERFECT", "text": "No rush, but could you check when it will be done?", "advice": "完璧です！『No rush』で配慮しつつ『check』で状況を確認できています。" },
      { "type": "TOO_COMPLEX", "text": "Kindly furnish an estimated timeframe regarding the finalization of the report.", "advice": "言葉が硬すぎて会話向きではありません。" },
      { "type": "TOO_DIRECT", "text": "Why is it taking so long? Finish it today.", "advice": "高圧的で相手のモチベーションを下げてしまいます。" }
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
