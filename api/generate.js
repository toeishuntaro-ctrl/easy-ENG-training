import { GoogleGenAI, Type } from "@google/genai";

function createSentenceChunks(sentence) {
  if (!sentence) return [];
  const trimmed = sentence.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 4) return words;

  // If comma exists, try splitting around commas or conjunctions
  if (trimmed.includes(',')) {
    const parts = trimmed.split(/(?<=,)\s+/);
    if (parts.length >= 3 && parts.length <= 5) return parts;
    if (parts.length === 2) {
      const res = [];
      parts.forEach(part => {
        const subWords = part.split(/\s+/);
        if (subWords.length > 3) {
          const mid = Math.ceil(subWords.length / 2);
          res.push(subWords.slice(0, mid).join(' '));
          res.push(subWords.slice(mid).join(' '));
        } else {
          res.push(part);
        }
      });
      return res;
    }
  }

  // Split into 3 to 4 natural rhythm chunks
  const chunkCount = words.length > 9 ? 4 : 3;
  const chunkSize = Math.ceil(words.length / chunkCount);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

function getPatternStem(pattern) {
  if (!pattern) return "";
  const clean = pattern.replace(/\[.*?\]/g, " ").replace(/[^a-zA-Z\s]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(" ").toLowerCase();
}

function synthesizePatternVariations(pattern, patternJp, target) {
  if (!pattern) pattern = "I see your point, but we need to [verb] first.";
  const cleanPat = pattern.replace(/\.\.\.$/, "").trim();

  const config1 = {
    verbs: ["share the updated data", "review it today", "start the work"],
    slots: {
      "\\[verb\\s+A\\]": "commit to this deadline",
      "\\[verb\\s+B\\]": "send a progress report by tomorrow",
      "\\[noun\\]": "the project schedule",
      "\\[noun/phrase\\]": "the priority",
      "\\[noun/gerund\\]": "delaying the submission",
      "\\[person\\]": "our team lead",
      "\\[person/team\\]": "our technical team",
      "\\[team\\]": "our operations team",
      "\\[time\\]": "tomorrow afternoon",
      "\\[statement\\]": "we need more time to verify this",
      "\\[clause\\]": "we get the final sign-off",
      "\\[task\\]": "the data audit",
      "\\[topic\\]": "the revised milestone",
      "\\[plan\\]": "the initial timeline",
      "\\[document\\]": "the draft proposal"
    }
  };

  const config2 = {
    verbs: ["confirm the exact scope", "prepare our team", "proceed smoothly"],
    slots: {
      "\\[verb\\s+A\\]": "change the plan right now",
      "\\[verb\\s+B\\]": "discuss this in our next sync",
      "\\[noun\\]": "the core requirements",
      "\\[noun/phrase\\]": "the action item",
      "\\[noun/gerund\\]": "missing the deadline",
      "\\[person\\]": "our project director",
      "\\[person/team\\]": "our QA manager",
      "\\[team\\]": "the local site coordinator",
      "\\[time\\]": "Friday morning",
      "\\[statement\\]": "we should keep the current priority",
      "\\[clause\\]": "there is any further delay",
      "\\[task\\]": "the system handover",
      "\\[topic\\]": "the budget adjustment",
      "\\[plan\\]": "the agreed scope",
      "\\[document\\]": "the CAPA report"
    }
  };

  function applySlot(pat, config) {
    let res = pat;
    let vIdx = 0;
    res = res.replace(/\[verb(?:\s+[A-Z0-9])?\]/gi, () => {
      const v = config.verbs[vIdx % config.verbs.length];
      vIdx++;
      return v;
    });
    if (config.slots) {
      for (const [key, val] of Object.entries(config.slots)) {
        res = res.replace(new RegExp(key, "gi"), val);
      }
    }
    res = res.replace(/\[.*?\]/g, "this").trim();
    if (!res.endsWith(".") && !res.endsWith("?")) res += ".";
    return res;
  }

  const vTarget1 = applySlot(cleanPat, config1);
  const vTarget2 = applySlot(cleanPat, config2);

  const cleanJp = (patternJp || "この型").replace(/\[.*?\]/g, "〜");

  return [
    {
      variation_prompt_jp: `「${cleanJp}」を使って、別の状況を伝える時は？`,
      variation_target: vTarget1,
      variation_hint_parts: "中学レベルの基本パーツを型に当てはめるだけ！",
      variation_chunks: createSentenceChunks(vTarget1)
    },
    {
      variation_prompt_jp: `「${cleanJp}」を応用して、別の条件を伝える時は？`,
      variation_target: vTarget2,
      variation_hint_parts: "型をそのまま固定し、パーツを入れ替えてみよう！",
      variation_chunks: createSentenceChunks(vTarget2)
    }
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 8 Categories of Practical Global Business Plain English Key Patterns (型)
  const patternLibrary = {
    acknowledge_boundary: {
      category: "受け止め・クッション＋制約提示 (Acknowledge & Set Boundaries)",
      patterns: [
        "I see your point, but we need to [verb] first.",
        "I understand the urgency, but our main priority is to [verb].",
        "That makes sense, but we are currently looking into [noun].",
        "I hear you, but let's make sure we [verb] before taking action.",
        "I appreciate the heads-up, but we cannot commit until we [verb].",
        "Fair point, but let's stick to [noun] for now."
      ]
    },
    takeaway_deadline: {
      category: "確認・持ち帰り・期限設定 (Takeaway & Set Deadlines)",
      patterns: [
        "Let me check with [person/team] and get back to you by [time].",
        "I am looking into this and will send an update by [time].",
        "I will double-check [noun] and confirm with you later today.",
        "Give me until [time] to verify this with [team].",
        "I will follow up on this with [person] by [time].",
        "Let's hold off on this until we hear back from [person]."
      ]
    },
    clarify_paraphrase: {
      category: "認識合わせ・明確化 (Clarify & Paraphrase)",
      patterns: [
        "Just to make sure, are you saying that [statement]?",
        "To be clear, do you mean we should [verb]?",
        "Could you clarify what you mean by [noun/phrase]?",
        "Let me make sure I understand: our next step is to [verb], right?",
        "Before we move forward, can we confirm who is leading [task]?",
        "Are we aligned that [statement]?"
      ]
    },
    alternative_tradeoff: {
      category: "代替案・条件付き合意・トレードオフ (Alternative & Give-and-Take)",
      patterns: [
        "We cannot [verb A], but we can [verb B] instead.",
        "If we prioritize [task A], we will need to push back [task B].",
        "What if we focus on [noun] first and handle the rest next week?",
        "To meet the deadline, our best option is to [verb].",
        "We are happy to help with this, provided that we get [noun] by [time].",
        "How about we do [option A] instead of [option B]?"
      ]
    },
    action_request: {
      category: "依頼・プッシュ・行動喚起 (Action Request & Gentle Push)",
      patterns: [
        "Could you please send over [noun] by [time] so we can proceed?",
        "To keep things on track, we need your input on [topic].",
        "Please let us know your decision by [time] so we don't lose time.",
        "Would you be able to review [document] before our next sync?",
        "Can you help us connect with [person] regarding this matter?",
        "Let's make sure everyone reviews [noun] by EOD."
      ]
    },
    flag_risk: {
      category: "懸念・リスクの事前共有 (Flagging Concerns & Risks)",
      patterns: [
        "My main concern is that [clause], so let's be careful.",
        "We might run into an issue if we don't [verb] early.",
        "To avoid any delays, it would be safer to [verb].",
        "There is a risk of [noun/gerund], so let's keep an eye on it.",
        "Let's make sure we have a backup plan in case [clause]."
      ]
    },
    lock_next_step: {
      category: "合意形成・Next Step固定 (Wrap-up & Action Lock)",
      patterns: [
        "Let's lock in [plan/date] as our target.",
        "I will summarize the action items and share the notes by [time].",
        "Thanks for the alignment; I will take ownership of [task].",
        "Let's touch base again on [day] to review the progress.",
        "We are all on the same page. Let's proceed with [plan]."
      ]
    },
    appreciation_partnership: {
      category: "感謝・パートナーシップ関係維持 (Appreciation & Partnership)",
      patterns: [
        "Thank you for your flexibility on this tight schedule.",
        "Thanks for understanding our team's capacity.",
        "I appreciate your quick turnaround on this issue.",
        "Thanks for working with us to find a practical solution."
      ]
    }
  };

  const { mode, topic, customPrompt, excludeTopics, excludePatterns } = req.body || {};
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

  // Select scenario pool based on requested topic or user custom situation
  let selectedCategoryPool = [];
  let topicDisplayTitle = "外資系プロジェクト交渉・実務";
  let activeTheme = "";
  let activeRoles = ["Marcus (Global VP)", "Sarah (Regional Lead)", "Julian (Technical Director)"];

  if (customPrompt && customPrompt.trim()) {
    topicDisplayTitle = `ユーザー持込案件: 「${customPrompt.trim().substring(0, 30)}」`;
    activeTheme = `User's real-world business challenge: ${customPrompt.trim()}`;
    activeRoles = ["Overseas Counterpart (Global Lead)", "Stakeholder / Client", "Project Specialist"];
  } else if (topic && topicCategories[topic]) {
    selectedCategoryPool = topicCategories[topic].scenarios;
    topicDisplayTitle = topicCategories[topic].title;
    const item = selectedCategoryPool[Math.floor(Math.random() * selectedCategoryPool.length)];
    activeTheme = item.theme;
    activeRoles = item.roles;
  } else {
    // All categories combined
    selectedCategoryPool = Object.values(topicCategories).flatMap(cat => cat.scenarios);
    const item = selectedCategoryPool[Math.floor(Math.random() * selectedCategoryPool.length)];
    activeTheme = item.theme;
    activeRoles = item.roles;
  }

  const randomSeed = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Dynamically select 5 distinct pattern categories for Stages 1 to 5 to guarantee high diversity
  const allCategoryKeys = Object.keys(patternLibrary);
  // Shuffle categories
  const shuffledKeys = [...allCategoryKeys].sort(() => 0.5 - Math.random());
  const selected5Categories = shuffledKeys.slice(0, 5);

  const excludedPatternList = Array.isArray(excludePatterns) ? excludePatterns : [];
  const excludedTopicList = Array.isArray(excludeTopics) ? excludeTopics : [];

  const stagePatternSuggestions = selected5Categories.map((catKey, idx) => {
    const cat = patternLibrary[catKey];
    // Filter out previously used patterns if possible
    const availablePatterns = cat.patterns.filter(p => !excludedPatternList.some(ex => ex && ex.toLowerCase().includes(p.substring(0, 15).toLowerCase())));
    const poolToUse = availablePatterns.length > 0 ? availablePatterns : cat.patterns;
    const pickedPattern = poolToUse[Math.floor(Math.random() * poolToUse.length)];
    return `Stage ${idx + 1} (${cat.category}): Suggested pattern idea -> "${pickedPattern}"`;
  });

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
- For each stage, teach ONE clear, versatile, reusable PLAIN ENGLISH KEY PATTERN (型).
- Provide a simple "parts_hint" showing how common junior-high level English words (e.g. "keep the deadline", "talk to my team", "tomorrow afternoon") combine with the pattern to complete the target sentence.
- This empowers users to immediately output the response without anxiety.

[CRITICAL MANDATE: MAXIMUM PATTERN DIVERSITY (キーフレーズ・型の完全重複禁止)]
- You MUST ensure all 5 stages in this session teach **COMPLETELY DIFFERENT KEY PATTERNS (型)** with different functional purposes.
- NEVER repeat or reuse the same opening/formula (e.g. do NOT use "I see your point..." or "Let me check..." more than once in the 5 stages).
- Here are 5 distinct suggested pattern categories assigned specifically for this session's 5 stages (you can use these or creative equivalents):
${stagePatternSuggestions.map(s => `  * ${s}`).join('\n')}

[Strictly Excluded Recent Patterns & Topics (DO NOT REUSE ANY OF THESE)]:
- Excluded Patterns: ${JSON.stringify(excludedPatternList.slice(-20))}
- Excluded Target Phrases: ${JSON.stringify(excludedTopicList.slice(-20))}

[Scenario Specifications]
- Focus Category: "${topicDisplayTitle}"
- Training Mode: "${mode || 'quiz'}"
- Mode Focus: ${modeDescription}
- Scenario Theme: "${activeTheme}"
- Typical Counterparts: ${activeRoles.join(', ')}
- Uniqueness Seed: ${randomSeed}

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
4. "key_pattern": The reusable English pattern/formula (e.g., "I see your point, but we need to [verb]...", "We cannot [verb A], but we can [verb B] instead", "Could you clarify what you mean by [noun]?"). MUST BE DISTINCT for each stage!
5. "key_pattern_jp": Meaning of the pattern in Japanese (e.g., "おっしゃることは分かりますが、〜する必要があります", "〜はできませんが、代わりに…なら可能です").
6. "pattern_rationale": Clear 1-2 sentence Japanese explanation of WHY this pattern works diplomatically in global business.
7. "parts_hint": Clear Japanese hint showing the simple junior-high level English parts to insert into the pattern (e.g., '"keep the deadline" (納期を守る) を組み合わせるだけ！', '"my team" と "tomorrow" を組み合わせるだけ！').
8. "guide": Clear Japanese mission telling the user what message to convey.
9. "target": The ideal, polished Plain English response formed by the pattern + parts. This MUST match the PERFECT choice.
10. "chunks": Array of 3 to 5 natural chunks (phrases/meaning blocks) that comprise the "target" sentence in correct order.
11. "counterpart_reaction_en": Realistic brief follow-up response (1-2 sentences) from the counterpart acknowledging, agreeing, or aligning next steps when the user replies with the ideal Plain English response.
12. "counterpart_reaction_jp": Natural Japanese translation of the counterpart's follow-up reaction.
13. "email_subject": Realistic corporate subject line (e.g., "Re: Urgent protocol deviation review", "Timeline adjustment request for Site 102").
14. "variations": Exactly 2 fast slot-swap drill variations for this SAME key pattern so the user immediately learns how to adapt the pattern to other practical situations.
    - CRITICAL ABSOLUTE MANDATE: Both variations MUST strictly practice and start with the EXACT SAME "key_pattern" of this stage! (Never use a different pattern or formula).
    - variation_prompt_jp: Japanese situation requesting this same pattern (e.g. "「〜と言いたい時は？」")
    - variation_target: Target English sentence strictly using the SAME pattern with simple junior-high parts inserted.
    - variation_hint_parts: Junior-high English parts hint showing what was combined.
    - variation_chunks: 3-4 word/phrase chunks for variation sentence assembly.
15. "choices": Exactly 3 distinct choices:
   **CRITICAL CONSTRAINT**: ALL 3 choices MUST start with or incorporate the EXACT SAME key pattern (e.g., "I see your point, but we need to..."). DO NOT give away the answer by having only one choice contain the pattern! The user must judge the junior-high vocabulary and tone in the remainder of the sentence:
   - type: "PERFECT"
     text: Natural, concise Plain English using the key pattern and simple junior-high level core vocabulary (e.g. "keep the original deadline first.").
     advice: Japanese commentary explaining why this pattern + simple junior-high parts is polite, clear, and trusted across global non-native teams.
   - type: "TOO_COMPLEX"
     text: Uses the SAME pattern, but finished with overly verbose, stiff, academic, or unnecessarily complicated words (e.g. "prioritize the predetermined chronological milestone per our charter.").
     advice: Japanese commentary pointing out that while the opening is good, the vocabulary is too stiff/wordy for clear multinational communication.
   - type: "TOO_DIRECT"
     text: Uses the SAME pattern, but finished with blunt, aggressive, or careless phrasing that lacks diplomatic partnership (e.g. "reject your impossible request immediately.").
     advice: Japanese commentary explaining why this phrasing sounds confrontational and damages trust with international colleagues.
`;

  const responseSchema = {
    type: Type.ARRAY,
    description: "Exactly 5 stages of sequential interactive dialogue with key patterns, slot-swap drill variations, scrambled chunks, and challenging 3-choice questions",
    items: {
      type: Type.OBJECT,
      properties: {
        stage: { type: Type.INTEGER, description: "Stage number from 1 to 5" },
        ai_name: { type: Type.STRING, description: "Counterpart role name" },
        ai_en: { type: Type.STRING, description: "English speech or message from counterpart" },
        ai_jp: { type: Type.STRING, description: "Japanese translation of counterpart speech" },
        key_pattern: { type: Type.STRING, description: "Reusable English pattern or formula" },
        key_pattern_jp: { type: Type.STRING, description: "Japanese translation/meaning of the pattern" },
        pattern_rationale: { type: Type.STRING, description: "Clear explanation of why this pattern works diplomatically with non-native global teams" },
        parts_hint: { type: Type.STRING, description: "Junior-high English parts hint to plug into the pattern" },
        guide: { type: Type.STRING, description: "Japanese mission instructions for the user" },
        target: { type: Type.STRING, description: "Target Plain English phrase (ideal response)" },
        counterpart_reaction_en: { type: Type.STRING, description: "Realistic follow-up reaction from counterpart when user responds with Plain English" },
        counterpart_reaction_jp: { type: Type.STRING, description: "Japanese translation of counterpart follow-up reaction" },
        email_subject: { type: Type.STRING, description: "Realistic subject line for email/Teams communications" },
        chunks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Target sentence split into 3-5 natural phrase chunks in correct order for sentence scrambling practice"
        },
        variations: {
          type: Type.ARRAY,
          description: "2 slot-swap practice variations for this key pattern",
          items: {
            type: Type.OBJECT,
            properties: {
              variation_prompt_jp: { type: Type.STRING, description: "Japanese variation situation mission" },
              variation_target: { type: Type.STRING, description: "English target sentence applying the same pattern with different parts" },
              variation_hint_parts: { type: Type.STRING, description: "Junior-high parts hint for variation" },
              variation_chunks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-4 phrase chunks for variation sentence assembly"
              }
            },
            required: ["variation_prompt_jp", "variation_target", "variation_hint_parts", "variation_chunks"]
          }
        },
        choices: {
          type: Type.ARRAY,
          description: "3 choices: one PERFECT, one TOO_COMPLEX, one TOO_DIRECT. All 3 must use the same key pattern.",
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
      required: ["stage", "ai_name", "ai_en", "ai_jp", "key_pattern", "key_pattern_jp", "parts_hint", "guide", "target", "variations", "choices"]
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

        // Validate and ensure 5 stages are numbered 1 to 5 with patterns, variations, and hints
        const formattedScenarios = scenarios.map((sc, idx) => {
          const target = sc.target || (sc.choices && sc.choices.find(c => c.type === 'PERFECT')?.text) || "";
          let chunks = Array.isArray(sc.chunks) && sc.chunks.length >= 2 ? sc.chunks.map(c => c.trim()).filter(Boolean) : [];
          if (chunks.length < 2) {
            chunks = createSentenceChunks(target);
          }

          // Process and strictly validate variations for slot-swap drilling
          const patternStem = getPatternStem(sc.key_pattern);
          let rawVariations = Array.isArray(sc.variations) && sc.variations.length > 0 ? sc.variations : [];
          
          // Only keep variations that actually contain the key pattern stem
          let validVariations = rawVariations.filter(v => {
            if (!v || !v.variation_target) return false;
            if (!patternStem) return true;
            return v.variation_target.toLowerCase().includes(patternStem);
          });

          // If valid variations are insufficient, synthesize matching variations directly from key_pattern
          let finalVariations;
          if (validVariations.length >= 2) {
            finalVariations = validVariations.slice(0, 2).map(v => {
              let vChunks = Array.isArray(v.variation_chunks) && v.variation_chunks.length >= 2 
                ? v.variation_chunks.map(c => c.trim()).filter(Boolean) 
                : createSentenceChunks(v.variation_target || "");
              return {
                variation_prompt_jp: v.variation_prompt_jp || "同じ型を使って表現してみましょう：",
                variation_target: v.variation_target || "",
                variation_hint_parts: v.variation_hint_parts || "中学英語パーツを入れ替えるだけ！",
                variation_chunks: vChunks
              };
            });
          } else {
            finalVariations = synthesizePatternVariations(sc.key_pattern, sc.key_pattern_jp, target);
          }

          return {
            stage: idx + 1,
            ai_name: sc.ai_name || "Stakeholder",
            ai_en: sc.ai_en || "",
            ai_jp: sc.ai_jp || "",
            key_pattern: sc.key_pattern || "I see your point, but we need to...",
            key_pattern_jp: sc.key_pattern_jp || "おっしゃることは分かりますが、〜する必要があります",
            pattern_rationale: sc.pattern_rationale || "相手の立場を尊重しつつ、中学レベルの平易な動詞で制約や次のアクションを明快に伝えることで、非ネイティブ同士でも誤解なく合意形成できます。",
            parts_hint: sc.parts_hint || "中学単語を当てはめて声に出してみましょう！",
            guide: sc.guide || "状況に応じて的確なPlain Englishで返答してください。",
            target: target,
            chunks: chunks,
            variations: finalVariations,
            counterpart_reaction_en: sc.counterpart_reaction_en || "Understood. That sounds like a reasonable next step. Let's keep each other posted.",
            counterpart_reaction_jp: sc.counterpart_reaction_jp || "承知しました。妥当な進め方ですね。引き続き進捗を共有し合いましょう。",
            email_subject: sc.email_subject || (sc.ai_en?.startsWith("Subject:") ? sc.ai_en.split("\n")[0].replace("Subject:", "").trim() : "Project update and next steps"),
            choices: Array.isArray(sc.choices) ? sc.choices : []
          };
        });

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
