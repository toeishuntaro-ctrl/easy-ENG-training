import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, excludeTopics } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment variables.' });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  // Clinical Trial Management & Global Pharmaceutical Business Scenarios
  const categories = [
    {
      theme: "Protocol amendment and IRB/IEC approval delay",
      roles: ["Sponsor Project Director", "Lead CRA", "Principal Investigator", "Regulatory Affairs Lead"]
    },
    {
      theme: "Investigational Product (IP) temperature excursion during logistics",
      roles: ["Supply Chain Specialist", "Site Pharmacist", "Sponsor Quality Assurance", "Lead CRA"]
    },
    {
      theme: "Site patient enrollment lagging behind schedule and mitigation plan",
      roles: ["Principal Investigator (Dr. Williams)", "Clinical Research Coordinator (CRC)", "Sponsor Medical Director"]
    },
    {
      theme: "Serious Adverse Event (SAE) reporting timeline escalation to Safety Board",
      roles: ["Site Sub-Investigator", "Global Drug Safety Lead", "Sponsor Safety Physician"]
    },
    {
      theme: "Site monitoring report critical findings and CRA performance management",
      roles: ["Senior CRA", "Clinical Operations Manager", "Quality Auditor"]
    },
    {
      theme: "Site budget, CTA contract negotiation impasse, and overhead costs",
      roles: ["Site Contract Officer", "Legal Counsel", "Sponsor Finance Director"]
    },
    {
      theme: "EDC Data Management query resolution deadlines and database lock risk",
      roles: ["Lead Data Manager", "Biostatistician", "Lead Site Coordinator"]
    },
    {
      theme: "Central laboratory bio-sample shipping error and courier mishandling",
      roles: ["Central Lab Coordinator", "Courier Vendor Logistics Manager", "Site CRC"]
    },
    {
      theme: "Regulatory inspection (FDA/PMDA) audit readiness and CAPA review",
      roles: ["External QA Auditor", "Hospital Compliance Director", "Sponsor Oversight Lead"]
    },
    {
      theme: "Investigator Meeting debate over patient eligibility inclusion/exclusion criteria",
      roles: ["Key Opinion Leader (PI)", "Sponsor Clinical Scientist", "Medical Monitor"]
    }
  ];

  const selectedItem = categories[Math.floor(Math.random() * categories.length)];
  const randomSeed = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Tailor instructions by training mode
  let modeDescription = "";
  if (mode === 'email') {
    modeDescription = "【Email / Teamsチャット通信モード】臨床試験マネージャー(CTM)と海外関係者（Sponsor, Vendor, Site）との緊急・重要メールやTeamsでのやり取り。AIの発言には件名(Subject:)や文脈を含め、簡潔で礼儀正しいPlain Englishビジネス文章を作成させてください。";
  } else if (mode === 'sim') {
    modeDescription = "【高圧ミーティング・交渉シミュレーション】海外スポンサーや治験責任医師とのWeb会議/電話会議での切迫した交渉。締切や責任、予算、リスクに関するプレッシャーに対して、的確で毅然としたPlain Englishで交渉するシナリオにしてください。";
  } else {
    modeDescription = "【口頭クイック回答クイズ】臨床試験の実務現場で日常的に直面する質問や相談に対し、基本動詞(get, take, check, put, keep)とクッション言葉を用いた簡潔なPlain Englishで即答するシナリオにしてください。";
  }

  const prompt = `You are a world-class Clinical Trial Manager (CTM) English communication specialist and instructional game designer.
Generate an engaging, practical 5-stage sequential business dialogue for Japanese clinical trial managers and pharma professionals.

[Scenario Specifications]
- Training Mode: "${mode || 'quiz'}"
- Mode Focus: ${modeDescription}
- Scenario Theme: "${selectedItem.theme}"
- Typical Counterparts: ${selectedItem.roles.join(', ')}
- Uniqueness Seed: ${randomSeed}
- Strictly Excluded Topics/Phrases (Do NOT repeat or reuse these):
${JSON.stringify((excludeTopics || []).slice(-15))}

[5-Stage Story Arc Progression]
- Stage 1: Initial situation / urgent inquiry or problem reported by the counterpart.
- Stage 2: Clarification / gathering essential details or uncovering an obstacle.
- Stage 3: Escalation / proposing a pragmatic mitigation action plan.
- Stage 4: Negotiation / aligning on timelines, responsibilities, or resource allocation.
- Stage 5: Final confirmation / securing stakeholder agreement and summarizing next steps.

[Content & Language Rules]
1. "ai_name": Counterpart role name (e.g., "Elena (Sponsor Director)", "Mark (Lead CRA)", "Dr. Sato (PI)").
2. "ai_en": Natural, realistic English statement from the counterpart (1-3 sentences).
3. "ai_jp": Accurate, natural Japanese translation of the counterpart's statement.
4. "guide": Clear Japanese instruction (ミッション) telling the CTM what message/intent to convey in Japanese.
5. "target": The ideal, polished Plain English response (concise, clear, highly professional, using core verbs and courteous cushion phrases). This should correspond directly to the PERFECT choice.
6. "choices": Exactly 3 distinct choices:
   - type: "PERFECT"
     text: Natural, concise Plain English that effectively achieves the mission without fluff.
     advice: Japanese commentary explaining why this answer is respectful, effective, and standard in global business.
   - type: "TOO_COMPLEX"
     text: Overly verbose, stiff, academic, or unnecessarily complicated English (using big words like "subsequently", "heretofore", "ameliorate" instead of clear plain verbs).
     advice: Japanese commentary pointing out that the language is too stiff/wordy and explaining how to simplify it.
   - type: "TOO_DIRECT"
     text: Blunt, aggressive, or careless phrasing that lacks diplomatic cushion or courtesy (e.g., "You must do this", "No, wait until Friday").
     advice: Japanese commentary explaining why this sounds rude or confrontational and how it damages professional trust.
`;

  const responseSchema = {
    type: Type.ARRAY,
    description: "Exactly 5 stages of sequential clinical trial interactive dialogue",
    items: {
      type: Type.OBJECT,
      properties: {
        stage: { type: Type.INTEGER, description: "Stage number from 1 to 5" },
        ai_name: { type: Type.STRING, description: "Counterpart role name" },
        ai_en: { type: Type.STRING, description: "English speech or message from counterpart" },
        ai_jp: { type: Type.STRING, description: "Japanese translation of counterpart speech" },
        guide: { type: Type.STRING, description: "Japanese mission instructions for the user" },
        target: { type: Type.STRING, description: "Target Plain English phrase (ideal response)" },
        choices: {
          type: Type.ARRAY,
          description: "3 choices: one PERFECT, one TOO_COMPLEX, one TOO_DIRECT",
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["PERFECT", "TOO_COMPLEX", "TOO_DIRECT"],
                description: "Choice type: PERFECT, TOO_COMPLEX, or TOO_DIRECT"
              },
              text: { type: Type.STRING, description: "English answer option text" },
              advice: { type: Type.STRING, description: "Japanese feedback advice explaining the nuance" }
            },
            required: ["type", "text", "advice"]
          }
        }
      },
      required: ["stage", "ai_name", "ai_en", "ai_jp", "guide", "target", "choices"]
    }
  };

  // Models priority list: fast & reliable flash-lite first, then flash-latest, then gemini-3.8-flash
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  let errors = [];

  for (const modelName of modelsToTry) {
    // Retry up to 2 times for each model in case of temporary 503 spike
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[AI Generate] Attempting model: ${modelName} (attempt ${attempt + 1})`);
        
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "You are an elite Clinical Trial Manager communication instructor. You generate structured 5-stage interactive Plain English training scenarios strictly conforming to the requested JSON schema.",
            temperature: 0.85,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });

        const rawText = response.text;
        if (!rawText) {
          throw new Error("Empty response returned from model.");
        }

        const scenarios = JSON.parse(rawText);

        if (!Array.isArray(scenarios) || scenarios.length === 0) {
          throw new Error("Model returned invalid or empty scenario array.");
        }

        // Validate and ensure 5 stages are numbered 1 to 5
        const formattedScenarios = scenarios.map((sc, idx) => ({
          stage: idx + 1,
          ai_name: sc.ai_name || "Stakeholder",
          ai_en: sc.ai_en || "",
          ai_jp: sc.ai_jp || "",
          guide: sc.guide || "状況に応じて的確なPlain Englishで返答してください。",
          target: sc.target || (sc.choices && sc.choices.find(c => c.type === 'PERFECT')?.text) || "",
          choices: Array.isArray(sc.choices) ? sc.choices : []
        }));

        console.log(`[AI Generate] Successfully generated ${formattedScenarios.length} stages using ${modelName}`);
        return res.status(200).json(formattedScenarios);

      } catch (err) {
        console.warn(`[AI Generate] ${modelName} attempt ${attempt + 1} failed:`, err.message);
        errors.push(`${modelName} (attempt ${attempt + 1}): ${err.message}`);
        
        // Wait briefly before retry if 503 / 429
        if (err.message && (err.message.includes('503') || err.message.includes('429') || err.message.includes('demand'))) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }
  }

  console.error('[AI Generate] All models failed. Detailed errors:', errors);
  return res.status(500).json({
    error: 'AI問題生成に失敗しました。',
    details: errors
  });
}
