import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, topic, excludeTopics } = req.body || {};
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

  // Categorized Global Project Management, Clinical Development, and Cross-Functional Topics
  const topicCategories = {
    pushback: {
      title: "納期・スコープ交渉 (Pushback & Scope)",
      scenarios: [
        {
          theme: "Pushing back diplomatically on an impossible short-notice deadline requested by senior leadership",
          roles: ["Marcus (Global VP of Operations)", "Sarah (Project Management Office Lead)", "Julian (Regional Director)"]
        },
        {
          theme: "Severe team resource shortage and negotiating task priorities to prevent burnout",
          roles: ["Diane (Department Head)", "Liam (Resource Allocation Manager)", "Chen (Cross-functional Project Lead)"]
        },
        {
          theme: "Client scope creep demanding unpaid extra work without timeline adjustments",
          roles: ["Richard (Client Relationship Lead)", "Emily (Commercial Director)", "Ken (Technical Project Lead)"]
        },
        {
          theme: "Sudden strategic pivot from Global HQ requiring scope realignment with local teams",
          roles: ["Charlotte (Global Strategy Director)", "Rajesh (Regional Implementation Lead)", "Taro (Japan Project Manager)"]
        },
        {
          theme: "Project budget overrun alert and proposing practical cost-saving alternatives",
          roles: ["Fiona (Global Finance Controller)", "Arthur (Program Manager)", "Linda (Operations Director)"]
        }
      ]
    },
    clarify: {
      title: "曖昧な指示のすり合わせ (Clarify & Align)",
      scenarios: [
        {
          theme: "Clarifying vague or ambiguous instructions from overseas counterparts to prevent rework",
          roles: ["Mei-Ling (APAC Regional Lead)", "Dave (Product Specialist)", "Anita (Workflow Coordinator)"]
        },
        {
          theme: "Aligning action items, deadlines, and ownership right before concluding a fast-paced global call",
          roles: ["Gary (Meeting Facilitator)", "Nadia (Quality Assurance Lead)", "Kenji (Project Coordinator)"]
        },
        {
          theme: "Handling a critical misunderstanding caused by language barriers and restoring alignment",
          roles: ["Lucas (South America Lead)", "Fatima (Global Communications)", "Naoko (Senior Specialist)"]
        },
        {
          theme: "Handing over critical project responsibilities before an extended leave or holiday shutdown",
          roles: ["Simona (European Backup Lead)", "Travis (Team Lead)", "Kenta (Project Manager)"]
        }
      ]
    },
    issue: {
      title: "トラブル対応・持ち帰り (Issue Handling & Takeaway)",
      scenarios: [
        {
          theme: "Buying time diplomatically on an unexpected high-stakes inquiry without losing credibility",
          roles: ["Jonathan (Executive Vice President)", "Laura (Legal Counsel)", "Ken (Operations Manager)"]
        },
        {
          theme: "Project milestone at risk due to critical overseas vendor delivery delay",
          roles: ["Vikram (Vendor Account Director)", "Jessica (Procurement Manager)", "Daniel (Operations Lead)"]
        },
        {
          theme: "System downtime or operational incident during peak hours and managing client expectations",
          roles: ["Alexander (Global IT Incident Manager)", "Sophia (Customer Success Lead)", "Hiroshi (Operations Lead)"]
        },
        {
          theme: "Lagging quarterly KPIs and presenting a transparent root-cause mitigation plan",
          roles: ["Stefan (Global Head of Performance)", "Aoi (Project Lead)", "Chloe (Business Analyst)"]
        }
      ]
    },
    meeting: {
      title: "会議進行・ファシリテーション (Meeting & Facilitation)",
      scenarios: [
        {
          theme: "Facilitating a heated virtual meeting where multiple time-zones and teams disagree on next steps",
          roles: ["Olivier (European Workstream Lead)", "Siddharth (Technical Architect)", "Hannah (Product Owner)"]
        },
        {
          theme: "Steering a derailed meeting back onto track when participants talk off-topic",
          roles: ["Mark (Senior Sponsor Lead)", "Caroline (Commercial Partner)", "Yuki (Meeting Facilitator)"]
        },
        {
          theme: "Encouraging quiet regional attendees to speak up and share feedback during a global town hall",
          roles: ["Andrea (Global VP)", "Takahiro (Local Specialist)", "Brenda (HR Business Partner)"]
        }
      ]
    },
    clinical: {
      title: "臨床開発・製薬実務 (Clinical Trial & Site/Sponsor)",
      scenarios: [
        {
          theme: "Protocol amendment delay and regulatory/IRB submission timeline crunch",
          roles: ["Elena (Sponsor Project Director)", "Mark (Lead CRA)", "Dr. Sato (Site Principal Investigator)", "Sarah (Regulatory Affairs Lead)"]
        },
        {
          theme: "Investigational Product (IP) temperature excursion during international transit",
          roles: ["Carlos (Global Supply Chain Specialist)", "Ken (Site Pharmacist)", "Sophie (Sponsor QA Director)", "Mark (Lead CRA)"]
        },
        {
          theme: "Clinical trial patient enrollment lagging behind quarterly targets and site rescue plan",
          roles: ["Dr. Williams (Principal Investigator)", "Yuki (Lead Clinical Research Coordinator)", "Marcus (Medical Operations Lead)"]
        },
        {
          theme: "Serious Adverse Event (SAE) urgent reporting timeline escalation to Safety Review Board",
          roles: ["Dr. Aris (Site Co-Investigator)", "Clara (Global Drug Safety Lead)", "David (Safety Medical Monitor)"]
        },
        {
          theme: "Site monitoring audit critical findings and corrective action plan (CAPA) alignment",
          roles: ["Alex (Senior CRA)", "Rachel (Clinical Operations Director)", "Hans (External Quality Auditor)"]
        },
        {
          theme: "Site budget negotiation impasse and institutional overhead cost pushback",
          roles: ["Jennifer (Hospital Contracts Officer)", "Thomas (Legal Counsel)", "Victor (Sponsor Finance Director)"]
        },
        {
          theme: "EDC clinical data query backlog risking interim database lock deadline",
          roles: ["Priya (Lead Data Manager)", "Kevin (Senior Biostatistician)", "Yuki (Lead Site Coordinator)"]
        },
        {
          theme: "Urgent unblinding or protocol deviation escalation during weekend on-call",
          roles: ["Dr. Tanaka (Sub-Investigator)", "Claire (Global Medical Monitor)", "Mark (Senior CRA)"]
        }
      ]
    },
    negotiation: {
      title: "タフな交渉・利害調整 (Tough Negotiation & Give-and-Take)",
      scenarios: [
        {
          theme: "De-escalating an aggressive counterpart demanding an immediate answer to a complex problem",
          roles: ["Michael (Demanding Client Sponsor)", "Evelyn (Senior Account Director)", "Daiki (Technical Lead)"]
        },
        {
          theme: "Asking for a concession (quid pro quo) in exchange for accepting an inconvenient urgent task",
          roles: ["Brenda (Global Workstream Lead)", "Carlos (Operations Partner)", "Yuto (Delivery Manager)"]
        },
        {
          theme: "Pressuring an indecisive stakeholder to make an approval decision before the hard cutoff",
          roles: ["Dr. Weber (Chief Decision Maker)", "Grace (Governance Lead)", "Tatsuya (Project Lead)"]
        },
        {
          theme: "Politely declining an out-of-scope favor request from an influential foreign colleague",
          roles: ["Anthony (Global Marketing Director)", "Beatrice (Compliance Officer)", "Sho (Operations Manager)"]
        }
      ]
    }
  };

  // Select scenario pool based on requested topic
  let selectedCategoryPool = [];
  let topicDisplayTitle = "外資系プロジェクト交渉・実務";

  if (topic && topicCategories[topic]) {
    selectedCategoryPool = topicCategories[topic].scenarios;
    topicDisplayTitle = topicCategories[topic].title;
  } else {
    // All categories combined
    selectedCategoryPool = Object.values(topicCategories).flatMap(cat => cat.scenarios);
  }

  const selectedItem = selectedCategoryPool[Math.floor(Math.random() * selectedCategoryPool.length)];
  const randomSeed = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Tailor instructions by training mode
  let modeDescription = "";
  if (mode === 'email') {
    modeDescription = "【Email / Teamsチャット通信モード】外資系企業の多国籍チーム、海外クライアント、ベンダーとの緊急・重要メールやTeamsでのやり取り。相手の発言には件名(Subject:)やコンテキストを含め、非ネイティブ同士でも誤解なく即座に意図が伝わる、簡潔で礼儀正しいPlain Englishビジネス文章を作成させてください。";
  } else if (mode === 'sim') {
    modeDescription = "【高圧ミーティング・交渉シミュレーション】海外のディレクター、クライアント、ステークホルダーとのWeb会議/電話会議での切迫した交渉。理不尽な締め切り、予期せぬトラブル、リソース不足、予算交渉のプレッシャーに対し、角を立てずに毅然と切り返すPlain Englishで交渉するシナリオにしてください。";
  } else {
    modeDescription = "【口頭クイック回答クイズ】外資系企業の多国籍プロジェクト現場で日常的に直面する急な質問、相談、プッシュバックに対し、基本動詞(get, take, check, put, keep, make, have, set)とクッション言葉を用いた簡潔なPlain Englishで即答するシナリオにしてください。";
  }

  const prompt = `You are a world-class Global Business Communication Coach specializing in practical Plain English for non-native multilingual professionals.
Generate a high-yield, structured 5-stage sequential business dialogue for Japanese professionals working in global multinational environments.

[Pedagogical Framework: Lesson + Pattern Practice (型 ＋ 中学単語の応用)]
- Do NOT expect the user to invent complex sentences from thin air.
- For each stage, teach ONE clear, versatile, reusable PLAIN ENGLISH KEY PATTERN (型), such as:
  * "I see your point, but we need to [verb]..."
  * "Let me check with [person] and get back to you by [time]."
  * "Just to make sure, are you saying that [statement]?"
  * "To keep things on track, could you please [verb]?"
- Provide a simple "parts_hint" showing how common junior-high level English words (e.g. "keep the deadline", "talk to my team", "tomorrow afternoon") combine with the pattern to complete the target sentence.
- This empowers users to immediately output the response without anxiety.

[Scenario Specifications]
- Focus Category: "${topicDisplayTitle}"
- Training Mode: "${mode || 'quiz'}"
- Mode Focus: ${modeDescription}
- Scenario Theme: "${selectedItem.theme}"
- Typical Counterparts: ${selectedItem.roles.join(', ')}
- Uniqueness Seed: ${randomSeed}
- Strictly Excluded Topics/Phrases (Do NOT repeat or reuse these):
${JSON.stringify((excludeTopics || []).slice(-15))}

[5-Stage Story Arc Progression]
- Stage 1: Initial situation / urgent inquiry, tough demand, or unexpected problem raised by the counterpart.
- Stage 2: Clarification / digging into details, acknowledging their point while stating current constraints.
- Stage 3: Proposal / proposing a realistic mitigation plan or counter-proposal.
- Stage 4: Negotiation / push-and-pull on timelines, trade-offs (give and take), or responsibilities.
- Stage 5: Final alignment / securing mutual agreement, summarizing clear next steps and ownership.

[Content & Language Rules]
1. "ai_name": Counterpart role name (e.g., "Elena (Sponsor Director)", "Rajesh (Regional Lead)", "Marcus (Global VP)", "Dr. Williams (PI)").
2. "ai_en": Natural, realistic English statement from the counterpart (1-3 sentences).
3. "ai_jp": Natural, context-rich Japanese translation of the counterpart's statement.
4. "key_pattern": The reusable English pattern/formula (e.g., "I see your point, but we need to [verb]...", "Let me check with [person] and get back to you by [time]").
5. "key_pattern_jp": Meaning of the pattern in Japanese (e.g., "おっしゃることは分かりますが、〜する必要があります", "〜に確認して…までに折り返します").
6. "parts_hint": Clear Japanese hint showing the simple junior-high level English parts to insert into the pattern (e.g., '"keep the deadline" (納期を守る) を組み合わせるだけ！', '"my team" と "tomorrow" を組み合わせるだけ！').
7. "guide": Clear Japanese mission telling the user what message to convey.
8. "target": The ideal, polished Plain English response formed by the pattern + parts. This MUST match the PERFECT choice.
9. "choices": Exactly 3 distinct choices:
   - type: "PERFECT"
     text: Natural, concise Plain English using the key pattern and simple core vocabulary.
     advice: Japanese commentary explaining why this pattern is polite, clear, and trusted across global non-native teams.
   - type: "TOO_COMPLEX"
     text: Overly verbose, stiff, academic, or unnecessarily complicated English (using stiff vocabulary like "subsequently", "heretofore", "endeavor" instead of clear plain verbs).
     advice: Japanese commentary pointing out that the language is too stiff/wordy and explaining how to simplify it.
   - type: "TOO_DIRECT"
     text: Blunt, aggressive, or careless phrasing that lacks diplomatic cushion or courtesy (e.g., "You must do this", "No, wait until Friday", "That is your problem").
     advice: Japanese commentary explaining why this sounds rude or confrontational and damages trust with international colleagues.
`;

  const responseSchema = {
    type: Type.ARRAY,
    description: "Exactly 5 stages of sequential interactive dialogue with key patterns and simple parts hints",
    items: {
      type: Type.OBJECT,
      properties: {
        stage: { type: Type.INTEGER, description: "Stage number from 1 to 5" },
        ai_name: { type: Type.STRING, description: "Counterpart role name" },
        ai_en: { type: Type.STRING, description: "English speech or message from counterpart" },
        ai_jp: { type: Type.STRING, description: "Japanese translation of counterpart speech" },
        key_pattern: { type: Type.STRING, description: "Reusable English pattern or formula" },
        key_pattern_jp: { type: Type.STRING, description: "Japanese translation/meaning of the pattern" },
        parts_hint: { type: Type.STRING, description: "Junior-high English parts hint to plug into the pattern" },
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
      required: ["stage", "ai_name", "ai_en", "ai_jp", "key_pattern", "key_pattern_jp", "parts_hint", "guide", "target", "choices"]
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
            systemInstruction: "You are an elite Global Business Communication Coach for non-native professionals. You generate structured 5-stage interactive dialogues teaching clear key patterns (型) combined with simple junior-high English parts, strictly conforming to the requested JSON schema.",
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

        // Validate and ensure 5 stages are numbered 1 to 5 with patterns and hints
        const formattedScenarios = scenarios.map((sc, idx) => ({
          stage: idx + 1,
          ai_name: sc.ai_name || "Stakeholder",
          ai_en: sc.ai_en || "",
          ai_jp: sc.ai_jp || "",
          key_pattern: sc.key_pattern || "I see your point, but we need to...",
          key_pattern_jp: sc.key_pattern_jp || "おっしゃることは分かりますが、〜する必要があります",
          parts_hint: sc.parts_hint || "中学単語を当てはめて声に出してみましょう！",
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
