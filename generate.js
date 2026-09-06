export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, excludeTopics } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  const categories = [
    "Protocol amendment and IRB/IEC approval delay",
    "Investigational Product (IP) temperature excursion or delivery logistics",
    "Site patient enrollment lagging behind schedule and mitigation plan",
    "Serious Adverse Event (SAE) reporting timeline escalation",
    "Site monitoring report non-compliance and CRA management",
    "Budget, site contract negotiation impasse, or CTA execution",
    "Data Management / EDC query resolution deadline pushback",
    "Vendor performance issue or central lab sample shipping error"
  ];

  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  const randomSeed = Date.now() + Math.random().toString();

  const prompt = `
You are an expert Clinical Trial Manager (CTM) English training content generator.
Generate a 5-stage interactive Plain English learning session for CTMs.

[Session Specifications]
- Training Mode: "${mode || 'quiz'}"
- Main Scenario Theme: "${selectedCategory}"
- Uniqueness Seed: "${randomSeed}"
- Strictly Excluded Topics/Phrases (DO NOT USE OR REPEAT THESE):
${JSON.stringify(excludeTopics || [])}

[Required JSON Schema]
Return ONLY a raw JSON array containing exactly 5 objects without markdown formatting or code blocks:
[
  {
    "stage": 1,
    "ai_name": "Counterpart Role (e.g., Sponsor Director, Lead CRA, Principal Investigator)",
    "ai_en": "English statement from counterpart",
    "ai_jp": "Japanese translation of counterpart's statement",
    "guide": "Short Japanese instruction for the CTM on how to respond",
    "target": "Ideal Plain English response phrase using concise, respectful language",
    "choices": [
      { "type": "PERFECT", "text": "Ideal Plain English phrase", "advice": "Japanese explanation on why this is effective" },
      { "type": "TOO_COMPLEX", "text": "Overly formal or verbose phrase", "advice": "Japanese explanation on why it is too complex" },
      { "type": "TOO_DIRECT", "text": "Blunt or overly aggressive phrase", "advice": "Japanese explanation on why it lacks consideration" }
    ]
  }
]
`;

  // 高性能モデル優先リスト（利用可能な中で最上位モデルを自動選択）
  const modelsToTry = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  let errors = [];

  for (const modelName of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.95,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Model Attempt Failed] ${modelName} (${response.status}): ${errText}`);
        errors.push(`${modelName}: ${response.status}`);
        continue; // 制限中は次のモデルへ自動切替
      }

      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        errors.push(`${modelName}: Empty response`);
        continue;
      }

      rawText = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

      const scenarios = JSON.parse(rawText);
      console.log(`[Success] Generated with ${modelName}`);
      return res.status(200).json(scenarios);

    } catch (err) {
      console.warn(`[Model Exception] ${modelName}:`, err.message);
      errors.push(`${modelName}: ${err.message}`);
    }
  }

  return res.status(500).json({
    error: 'All Gemini models failed.',
    details: errors
  });
}

