export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, excludeTopics } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  // 毎回異なるシチュエーションを強制選定するテーマプール
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
- Training Mode: "${mode}" (quiz, sim, or email)
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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.95, // ランダム性と創造性を高める設定
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const scenarios = JSON.parse(rawText);

    return res.status(200).json(scenarios);
  } catch (err) {
    console.error("Generate API Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
