export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  
  const { mode = 'quiz', excludeTopics = [] } = req.body || {};

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const simCategories = [
    "Site initiation & IRB/EC approval delays",
    "Protocol deviations & IP (Investigational Product) management",
    "SAE reporting & Safety queries from Sponsor",
    "CRA monitoring report findings & Site communication",
    "Vendor management (Central Lab, eCOA, CRO) & Budget negotiation",
    "Subject recruitment timeline & Site retention strategies"
  ];
  
  const quizCategories = [
    "Negotiating deadlines and pushing back respectfully",
    "Asking for clarification without sounding aggressive",
    "Politely declining sudden change requests",
    "Updating status and giving realistic timeframes",
    "Escalating issues while maintaining good working relationships"
  ];

  const emailCategories = [
    "Formal status escalation emails to Sponsor",
    "Polite deadline reminder emails to CRA or Site",
    "Teams/Slack quick response messages to urgent Sponsor inquiries",
    "Professional written follow-up after an issue resolution call"
  ];

  let categories = quizCategories;
  if (mode === 'sim') categories = simCategories;
  else if (mode === 'email') categories = emailCategories;

  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  const randomSeed = Math.floor(Math.random() * 100000);

  let modeInstruction = `Focus on general Plain English business communication. Today's primary focus area: ${selectedCategory}.`;
  if (mode === 'sim') {
    modeInstruction = `Focus specifically on Clinical Trial Management (CTM) spoken scenarios. Today's primary focus area: ${selectedCategory}.`;
  } else if (mode === 'email') {
    modeInstruction = `Focus on written CTM & Business English (Emails & Teams chat messages). Target responses should be structured for written professional communications. Today's primary focus area: ${selectedCategory}.`;
  }

  const excludeInstruction = excludeTopics.length > 0
    ? `\n# AVOID REPETITION\nDo NOT reuse or duplicate the following recent targets/topics:\n${excludeTopics.slice(0, 15).map(t => `- ${t}`).join('\n')}\n`
    : '';

  const prompt = `You are a business English game engine for global non-native professionals.
Generate a set of 5 completely unique roleplay stages for a daily practice session.
Output STRICTLY JSON with no extra text or markdown wrappers.

# FOCUS AREA & CONTEXT
${modeInstruction}
Random Context ID: ${randomSeed}
${excludeInstruction}

# RULES FOR GENERATION
- Target: Non-native business professionals working in global teams.
- Focus on Plain English: Basic verbs (get, take, check, put) and polite cushion phrases.
- Vary the roles, names, and scenarios across all 5 stages.
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
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85
          }
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
