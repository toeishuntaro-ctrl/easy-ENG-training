import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    messages = [], 
    userText = '', 
    character = 'Sarah (Global Sponsor Lead)', 
    topic = 'Negotiating deadline and scope', 
    turn = 1, 
    maxTurns = 4,
    chatStyle = 'teams',
    // Legacy support
    targetPhrase, 
    japaneseGuide, 
    scenario 
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY;

  // If no API key, return intelligent fallback roleplay response
  if (!apiKey) {
    return res.status(200).json(getFallbackRallyResponse(character, topic, turn, userText || (messages[messages.length - 1]?.text || ''), chatStyle));
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const conversationHistoryText = messages.length > 0 
    ? messages.map(m => `${m.role === 'ai' ? character : 'User'}: ${m.text}`).join('\n')
    : `User: ${userText}`;

  const isFinalTurn = turn >= maxTurns;
  const isTeams = chatStyle === 'teams';

  const styleContext = isTeams 
    ? `# COMMUNICATION CHANNEL: Microsoft Teams Chat / Internal Business Casual
- Tone: Realistic internal chat between colleagues/stakeholders. Concise, responsive, polite yet business-casual (avoiding overly stiff greetings or essay-length text).
- Objective: Fast alignment, clear next steps, and concrete ETAs.
- Coach Focus: Specifically evaluate "Teamsチャット時短・明瞭さ" (clarity, brevity, middle school verbs like check/ping/send/get/confirm, actionable closing).`
    : `# COMMUNICATION CHANNEL: Live Online Meeting / Negotiation
- Tone: Natural spoken business conversation.
- Coach Focus: Spoken Plain English fluency, rhythm, and clear consensus building.`;

  const prompt = `You are playing the role of "${character}" in a realistic global business communication and negotiation simulation.
You are also an expert Plain English coach for global non-native business professionals.

# TOPIC / SITUATION:
${topic || scenario || "Negotiating deadline and priorities in a clinical project"}

${styleContext}

# CONVERSATION SO FAR:
${conversationHistoryText}

# CURRENT TURN:
Turn ${turn} of max ${maxTurns}

# CRITICAL MANDATES FOR REALISTIC BUSINESS COMMUNICATION (リアリズムと脱ループの最重要原則):

1. ABSOLUTE BAN ON REPETITION / CIRCULAR RALLIES (同じ約束・期日の反復ループ絶対禁止):
   - In real-world business (especially Teams/Slack chat), once a person commits to an ETA or action (e.g., "I will check with the CRA and send the scope by 2 PM"):
     * DO NOT have ${character} say "I'll wait for your message at 2 PM", and then prompt the user to say "I'll send it at 2 PM" AGAIN! That is an absurd, unnatural loop.
     * If the user already promised a specific time/action, that topic is SETTLED and CONFIRMED. Never repeat it back and forth.

2. DYNAMIC EARLY CONCLUSION (合意・期日設定完了時の即時クロージング):
   - If the user's latest message has provided a clear, acceptable solution, commitment, or concrete ETA (e.g., "I will investigate X and update you by 2 PM" or "What if we release module 1 now and module 2 next week?"):
     * And there is NO urgent secondary operational question needed:
     * Set "is_concluded": true IMMEDIATELY! (Even if turn < maxTurns! Do not artificially pad turns).
     * ${character}'s reply should be a concise, realistic closing: e.g., "Understood, that works. I appreciate the quick turnaround. I'll watch for your 2 PM update. Thanks!"
     * When "is_concluded": true, provide "final_score" (88-98) and an insightful "final_summary_jp" explaining that prompt ETA confirmation + clean closing is the golden standard of business chat.
     * Set "suggested_quick_replies" to 1-tap final closing reactions: ["👍 (Teamsリアクション完了)", "Will do. Thanks!", "On it."].

3. PURPOSEFUL CONVERSATIONAL PROGRESSION (会話を続ける場合の必須展開ルール):
   - If the conversation is NOT yet concluding ("is_concluded": false):
     * ${character} MUST NOT say empty filler like "Sounds good, let me know if you hit blockers".
     * Instead, ${character} MUST introduce a REALISTIC NEW BUSINESS DEVELOPMENT, operational decision, or next step to advance the project!
     * Examples of realistic follow-up questions:
       - Risk containment: "Understood on the 2 PM ETA. In the meantime, should we temporarily pause data sync on Site 102 to prevent further corruption, or keep it active?"
       - Ownership / escalation: "Got it. Who from our team will brief QA if this deviation requires an official filing?"
       - Resource / impact: "Does this issue impact patient safety or study endpoints, or is it purely metadata?"
       - Scope trade-off: "If we split the rollout into two phases, can we guarantee the core QA tests will pass by Friday?"
     * The 3 "suggested_quick_replies" MUST directly address this NEW operational question, NEVER repeating the previous turn's promise!

4. COACHING & FEEDBACK:
   - "coach_feedback_jp": 1-2 sentence constructive Japanese feedback on the user's latest response (specifically noting whether their ETA/commitment was clear, and praising conciseness).
   - "better_plain_english": An ideal Plain English version using middle school core verbs (get, check, send, keep, put, let).
   - "key_pattern_suggested": A practical, versatile reusable pattern.
   - "key_pattern_jp": Japanese explanation of the pattern.

Output strictly JSON adhering to the schema.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      ai_reply_en: { type: Type.STRING, description: "Your response in English as the character" },
      ai_reply_jp: { type: Type.STRING, description: "Japanese translation of your response" },
      coach_feedback_jp: { type: Type.STRING, description: "1-2 sentence coach feedback in Japanese on user's statement (clarity, tone)" },
      better_plain_english: { type: Type.STRING, description: "An ideal, ultra-clear Plain English rephrase of user's statement using basic verbs" },
      key_pattern_suggested: { type: Type.STRING, description: "A reusable Plain English formula/pattern (e.g. 'What if we [verb] first and [verb] later?')" },
      key_pattern_jp: { type: Type.STRING, description: "Japanese explanation of the pattern" },
      suggested_quick_replies: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 concise Plain English reply candidates for the user to say next"
      },
      is_concluded: { type: Type.BOOLEAN, description: "True if the conversation reached a natural conclusion or final turn" },
      final_score: { type: Type.INTEGER, description: "Score from 0 to 100 on clarity, alignment, and Plain English usage (only for final turn, or null)" },
      final_summary_jp: { type: Type.STRING, description: "Overall summary and encouragement in Japanese if concluded" }
    },
    required: [
      "ai_reply_en", "ai_reply_jp", "coach_feedback_jp", "better_plain_english",
      "key_pattern_suggested", "key_pattern_jp", "suggested_quick_replies", "is_concluded"
    ]
  };

  const models = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-flash-latest'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.4,
          maxOutputTokens: 800
        }
      });

      const parsed = JSON.parse(response.text);

      // 追加の安全チェック：もしAIが「待っています」「了解」「Sounds good」等で締めくくっている場合、またはユーザーが既に期日を確約している場合は自然にクローズ判定
      const aiText = (parsed.ai_reply_en || '').toLowerCase();
      const userLower = (userText || '').toLowerCase();
      const isClosingReply = aiText.includes("i'll wait for") || aiText.includes("sounds good") || aiText.includes("keep an eye out") || aiText.includes("talk then") || aiText.includes("thanks for the quick");
      const userHasEta = /\b(by \d|by noon|by tomorrow|later today|will send|will get back)\b/i.test(userLower);

      if ((isClosingReply && userHasEta) || turn >= maxTurns) {
        parsed.is_concluded = true;
        if (!parsed.final_score) parsed.final_score = 95;
        if (!parsed.final_summary_jp) {
          parsed.final_summary_jp = "🎉 迅速な合意達成！「いつまでに何をするか」を明確に伝え、相手が了承した時点で無駄な引き延ばしをせずスマートにチャットを完了できました。";
        }
      }

      return res.status(200).json(parsed);
    } catch (e) {
      lastError = e;
      console.warn(`[Chat Handler] Error with ${model}:`, e.message);
    }
  }

  // Fallback if API call failed
  console.warn("Falling back to local simulation response due to API error:", lastError?.message);
  return res.status(200).json(getFallbackRallyResponse(character, topic, turn, userText, chatStyle));
}

function getFallbackRallyResponse(character, topic, turn, userText, chatStyle = 'teams') {
  const isTeams = chatStyle === 'teams';
  const userLower = (userText || '').toLowerCase();
  const hasCommitment = /\b(by \d|by noon|by tomorrow|later today|will send|will check|will update|will get back|looking into)\b/i.test(userLower);

  // ユーザーが期限や対応をコミットした場合、あるいはターン進行時はループさせずに早期合意クローズ
  if (hasCommitment || turn >= 2) {
    return {
      ai_reply_en: "Sounds good. I appreciate the quick turnaround. I'll watch for your update. Thanks!",
      ai_reply_jp: "了解しました。迅速なご対応ありがとうございます。アップデートをお待ちしています！",
      coach_feedback_jp: "「いつまでに何をするか」を明確に即答できており、ビジネスチャットとして満点の対応です！相手が了承した時点でスパッと会話を切り上げるのがスマートな実務マナーです。",
      better_plain_english: "Understood. I will check with the team and send the update by 2 PM.",
      key_pattern_suggested: "I will [verb] and update you by [time].",
      key_pattern_jp: "〜を確認し、○時までに更新をご報告します（納期を明示する基本形）",
      suggested_quick_replies: [
        "👍 (Teamsリアクション完了)",
        "Will do. Speak then!",
        "On it. Thanks!"
      ],
      is_concluded: true,
      final_score: 96,
      final_summary_jp: "🎉 迅速な合意達成！余計な引き伸ばしをせず、期限の明示と確実な受け止めでプロフェッショナルに会話をクローズできました。"
    };
  }

  // 継続する場合：同じ期日をオウム返しせず、次の具体的な実務判断（暫定措置や二次リスク）へ発展させる
  return {
    ai_reply_en: "Understood on the investigation. In the meantime, should we temporarily pause data sync for this site to prevent further errors, or keep it running?",
    ai_reply_jp: "調査の件は承知しました。その間、エラー拡大を防ぐために当該サイトのデータ同期を一時停止すべきでしょうか、それとも稼働を継続しますか？",
    coach_feedback_jp: "初動の受け止めは良好です！相手から暫定措置の判断を求められたので、リスクを最小化する提案を中学動詞で簡潔に返しましょう。",
    better_plain_english: "Let's pause the data sync until we confirm the root cause.",
    key_pattern_suggested: "Let's [verb] until we [verb]...",
    key_pattern_jp: "〜を確認するまで、いったん…しましょう（暫定リスクヘッジの型）",
    suggested_quick_replies: [
      "Let's pause the sync temporarily until the CRA confirms the root cause.",
      "We can keep it running, but I will monitor the error logs every hour.",
      "I suggest we pause data entry for Site 102 to protect database integrity."
    ],
    is_concluded: false
  };
}

