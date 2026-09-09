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
    // Legacy support
    targetPhrase, 
    japaneseGuide, 
    scenario 
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY;

  // If no API key, return intelligent fallback roleplay response
  if (!apiKey) {
    return res.status(200).json(getFallbackRallyResponse(character, topic, turn, userText || (messages[messages.length - 1]?.text || '')));
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

  const prompt = `You are playing the role of "${character}" in a realistic global business negotiation simulation.
You are also an expert Plain English coach for global non-native business professionals.

# TOPIC / SITUATION:
${topic || scenario || "Negotiating deadline and priorities in a clinical project"}

# CONVERSATION SO FAR:
${conversationHistoryText}

# CURRENT TURN:
Turn ${turn} of ${maxTurns} ${isFinalTurn ? "(Final turn to conclude the negotiation)" : ""}

# YOUR DUAL TASK:
1. Respond in-character as ${character}. Be realistic, constructive, professional, and slightly challenging if the user is vague. If this is the final turn (${isFinalTurn}), aim to reach an agreeable alignment.
2. Act as a Plain English Coach:
   - Provide feedback in Japanese on the user's latest message.
   - Suggest a "Better Plain English" alternative that uses simple, high-impact middle school verbs (get, take, check, put, keep, send) and cushion phrases instead of stiff bureaucratic jargon.
   - Suggest a "Recommended Key Pattern" (型) for the next step.
   - Suggest 3 quick reply options for the user.

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

  const models = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
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
          temperature: 0.5,
          maxOutputTokens: 800
        }
      });

      const parsed = JSON.parse(response.text);
      return res.status(200).json(parsed);
    } catch (e) {
      lastError = e;
      console.warn(`[Chat Handler] Error with ${model}:`, e.message);
    }
  }

  // Fallback if API call failed
  console.warn("Falling back to local simulation response due to API error:", lastError?.message);
  return res.status(200).json(getFallbackRallyResponse(character, topic, turn, userText));
}

function getFallbackRallyResponse(character, topic, turn, userText) {
  const isConcluded = turn >= 4;
  const fallbacks = [
    {
      ai_reply_en: "I see your point, but we have a strict commitment with the executive committee. What is your concrete mitigation plan if we adjust the timeline?",
      ai_reply_jp: "言いたいことは分かりますが、経営委員会との厳格な約束があります。スケジュールを調整する場合、具体的なリスク軽減策は何ですか？",
      coach_feedback_jp: "要件を伝えられていますが、相手の懸念（役員報告・納期）に対する配慮を最初に一言添えると合意率が大幅に上がります。",
      better_plain_english: "I understand your concern about the timeline. Here is our plan to protect the core release.",
      key_pattern_suggested: "I understand your concern about [noun]; here is our plan to [verb]...",
      key_pattern_jp: "〜に関するご懸念はよく分かります。…するための弊社の対策は以下の通りです。",
      suggested_quick_replies: [
        "What if we release the core module first, and deliver the report next week?",
        "Let me check with the site team today and confirm the exact impact by 4 PM.",
        "We can add two backup resources to keep the original deadline on track."
      ],
      is_concluded: false
    },
    {
      ai_reply_en: "That sounds much more feasible. If we split the release into two phases, can you guarantee that quality and compliance won't be compromised?",
      ai_reply_jp: "それならかなり現実的ですね。もしリリースを2段階に分けた場合、品質とコンプライアンスが損なわれないと保証できますか？",
      coach_feedback_jp: "段階的な提案が非常に明快で、相手が前向きに検討し始めています！次は『保証する』という強いコミットメントをシンプルな動詞で伝えましょう。",
      better_plain_english: "Yes, I will make sure the quality stays high by keeping full QA reviews.",
      key_pattern_suggested: "I will make sure [clause] by [verb-ing]...",
      key_pattern_jp: "〜することで、確実に…を担保いたします。",
      suggested_quick_replies: [
        "I will make sure our QA lead signs off on every step before deployment.",
        "Yes, we will run all regression tests without skipping any items.",
        "Let me send you the updated checklist by tomorrow morning to give you full visibility."
      ],
      is_concluded: false
    },
    {
      ai_reply_en: "Great. That gives me the confidence I need to brief our VP. Let's document this agreement and align again on Thursday afternoon.",
      ai_reply_jp: "素晴らしい。それなら自信を持ってVP（副社長）に報告できます。合意内容をドキュメントにまとめ、木曜午後に再度すり合わせましょう。",
      coach_feedback_jp: "お見事です！相手の信頼を獲得し、円満に合意を形成できました。最後は感謝と次回アクションを簡潔に返してクロージングしましょう。",
      better_plain_english: "Thank you for your flexibility. I will send a quick recap by EOD today.",
      key_pattern_suggested: "Thanks for working together on this; I will send a summary by [time].",
      key_pattern_jp: "調整にご協力いただきありがとうございます。[時間]までに要約をお送りします。",
      suggested_quick_replies: [
        "Thanks for working together on this. I will send the summary notes shortly.",
        "Sounds like a solid plan. Looking forward to speaking with you on Thursday.",
        "Thank you Sarah. I will keep you closely updated on our progress."
      ],
      is_concluded: true,
      final_score: 94,
      final_summary_jp: "🎉 合意形成に大成功しました！相手の懸念を受け止め、中学生レベルの基本動詞（make sure, check, send）を使ってシンプルかつ力強く交渉を進められました。"
    }
  ];

  const idx = Math.min(turn - 1, fallbacks.length - 1);
  return fallbacks[idx];
}

