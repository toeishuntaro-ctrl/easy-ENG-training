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
  const patLower = cleanPat.toLowerCase();

  // 1. 頻出コア構文パターンごとの実務特化・完全差別化バリエーション辞書
  // 応用ドリル1と2で全く異なるビジネス状況（期日相談 vs スコープ分割など）を提示
  if (patLower.startsWith("would it be")) {
    return [
      {
        variation_prompt_jp: "【期日延期の相談】「期日を来週月曜まで延期することは可能でしょうか？」",
        variation_target: "Would it be possible to extend the deadline to next Monday?",
        variation_hint_parts: '"extend the deadline"（期日を延ばす）と "to next Monday"（来週月曜まで）を型に当てはめるだけ！',
        variation_chunks: ["Would it be possible", "to extend the deadline", "to next Monday?"]
      },
      {
        variation_prompt_jp: "【スコープ分割の提案】「作業範囲を2つのフェーズに分けることは可能でしょうか？」",
        variation_target: "Would it be possible to split the scope into two phases?",
        variation_hint_parts: '"split the scope"（範囲を分割）と "into two phases"（2段階に）を型に当てはめるだけ！',
        variation_chunks: ["Would it be possible", "to split the scope", "into two phases?"]
      }
    ];
  }

  if (patLower.startsWith("i see your point") || patLower.startsWith("i understand")) {
    return [
      {
        variation_prompt_jp: "【品質確認の優先】「おっしゃることは分かりますが、まずはテスト結果を確認する必要があります」",
        variation_target: "I see your point, but we need to check the test results first.",
        variation_hint_parts: '"check the test results"（テスト結果を確認する）を当てはめるだけ！',
        variation_chunks: ["I see your point,", "but we need to check", "the test results first."]
      },
      {
        variation_prompt_jp: "【チーム方針のすり合わせ】「おっしゃることは分かりますが、まずはチームと合意を取る必要があります」",
        variation_target: "I see your point, but we need to align with our team first.",
        variation_hint_parts: '"align with our team"（チームと足並みを揃える）を当てはめるだけ！',
        variation_chunks: ["I see your point,", "but we need to align", "with our team first."]
      }
    ];
  }

  if (patLower.startsWith("i am looking into") || patLower.startsWith("i'm looking into")) {
    return [
      {
        variation_prompt_jp: "【不具合調査の報告】「システムエラーの原因を調査中であり、本日夕方5時までに状況をご連絡します」",
        variation_target: "I am looking into the system error and will send an update by 5 PM.",
        variation_hint_parts: '"the system error"（システムエラー）と "send an update by 5 PM" を組み合わせるだけ！',
        variation_chunks: ["I am looking into", "the system error", "and will send an update", "by 5 PM."]
      },
      {
        variation_prompt_jp: "【契約条件の確認】「契約条件を調査中であり、明日朝一番にご連絡いたします」",
        variation_target: "I am looking into the contract terms and will get back to you by tomorrow morning.",
        variation_hint_parts: '"the contract terms"（契約条件）と "get back to you by tomorrow morning" を組み合わせるだけ！',
        variation_chunks: ["I am looking into", "the contract terms", "and will get back to you", "by tomorrow morning."]
      }
    ];
  }

  if (patLower.startsWith("let me check with") || patLower.startsWith("let me check")) {
    return [
      {
        variation_prompt_jp: "【法務チームへの確認】「法務チームに確認の上、明日までに折り返しご連絡いたします」",
        variation_target: "Let me check with our legal team and get back to you by tomorrow.",
        variation_hint_parts: '"our legal team"（法務チーム）と "by tomorrow"（明日までに）を当てはめるだけ！',
        variation_chunks: ["Let me check with", "our legal team", "and get back to you", "by tomorrow."]
      },
      {
        variation_prompt_jp: "【技術リードへの確認】「テックリードに確認の上、本日15時までにご連絡いたします」",
        variation_target: "Let me check with the tech lead and get back to you by 3 PM.",
        variation_hint_parts: '"the tech lead"（技術責任者）と "by 3 PM"（午後3時まで）を当てはめるだけ！',
        variation_chunks: ["Let me check with", "the tech lead", "and get back to you", "by 3 PM."]
      }
    ];
  }

  if (patLower.startsWith("we need to") || patLower.startsWith("i need to")) {
    return [
      {
        variation_prompt_jp: "【リリース遅延の防止】「リリース遅延を防ぐために、仕様を本日中に確定する必要があります」",
        variation_target: "We need to finalize the specification today in order to avoid release delays.",
        variation_hint_parts: '"finalize the specification today" と "in order to avoid release delays" を組み合わせるだけ！',
        variation_chunks: ["We need to finalize", "the specification today", "in order to avoid", "release delays."]
      },
      {
        variation_prompt_jp: "【監査基準の達成】「コンプライアンス基準を満たすために、全監査ログを保存する必要があります」",
        variation_target: "We need to save all audit logs in order to meet compliance standards.",
        variation_hint_parts: '"save all audit logs" と "in order to meet compliance standards" を組み合わせるだけ！',
        variation_chunks: ["We need to save", "all audit logs", "in order to meet", "compliance standards."]
      }
    ];
  }

  if (patLower.startsWith("could you please") || patLower.startsWith("could you")) {
    return [
      {
        variation_prompt_jp: "【修正議事録の確認依頼】「金曜日の正午までに、修正した議事録をご確認いただけますでしょうか？」",
        variation_target: "Could you please review the revised minutes by Friday noon?",
        variation_hint_parts: '"review the revised minutes"（修正議事録の確認）と "by Friday noon"（金曜正午まで）',
        variation_chunks: ["Could you please review", "the revised minutes", "by Friday noon?"]
      },
      {
        variation_prompt_jp: "【最新見積書の送付依頼】「明日のミーティング前までに、最新の見積書をお送りいただけますでしょうか？」",
        variation_target: "Could you please send the updated estimate before tomorrow's meeting?",
        variation_hint_parts: '"send the updated estimate"（更新版見積もり）と "before tomorrow\'s meeting"',
        variation_chunks: ["Could you please send", "the updated estimate", "before tomorrow's meeting?"]
      }
    ];
  }

  if (patLower.startsWith("could we") || patLower.startsWith("can we")) {
    return [
      {
        variation_prompt_jp: "【重要機能の絞り込み打診】「納期に間に合わせるため、優先機能を絞り込むことはできますか？」",
        variation_target: "Could we prioritize key features so that we can launch on time?",
        variation_hint_parts: '"prioritize key features" と "so that we can launch on time" を組み合わせるだけ！',
        variation_chunks: ["Could we prioritize key features", "so that we can launch", "on time?"]
      },
      {
        variation_prompt_jp: "【短時間ミーティングの打診】「認識を統一するために、15分の同期コールを開くことはできますか？」",
        variation_target: "Could we schedule a 15-minute call so that we can align on expectations?",
        variation_hint_parts: '"schedule a 15-minute call" と "so that we can align on expectations" を組み合わせるだけ！',
        variation_chunks: ["Could we schedule a 15-minute call", "so that we can align", "on expectations?"]
      }
    ];
  }

  if (patLower.startsWith("i will")) {
    return [
      {
        variation_prompt_jp: "【データ再集計の約束】「数字を再集計し、本日中に進捗をご報告いたします」",
        variation_target: "I will recount the figures and keep you posted by end of day.",
        variation_hint_parts: '"recount the figures"（数値を再集計）と "by end of day"（本日中）',
        variation_chunks: ["I will recount the figures", "and keep you posted", "by end of day."]
      },
      {
        variation_prompt_jp: "【修正パッチ配布の約束】「修正パッチを適用し、明日正午までに結果をお知らせします」",
        variation_target: "I will apply the hotfix and keep you posted by tomorrow noon.",
        variation_hint_parts: '"apply the hotfix"（パッチを適用）と "by tomorrow noon"（明日正午まで）',
        variation_chunks: ["I will apply the hotfix", "and keep you posted", "by tomorrow noon."]
      }
    ];
  }

  if (patLower.startsWith("to prevent") || patLower.startsWith("to avoid") || patLower.startsWith("to ensure") || patLower.startsWith("to stay")) {
    return [
      {
        variation_prompt_jp: "【データ不整合の防止】「データの不整合を防ぐため、金曜日までに同期スクリプトを実行すべきです」",
        variation_target: "To prevent data mismatch, we should run the sync script by Friday.",
        variation_hint_parts: '"To prevent data mismatch" と "we should run the sync script"',
        variation_chunks: ["To prevent data mismatch,", "we should run the sync script", "by Friday."]
      },
      {
        variation_prompt_jp: "【予算内での達成】「予算内に抑えるため、外部委託スコープを縮小すべきです」",
        variation_target: "To stay within budget, we should reduce external consulting hours.",
        variation_hint_parts: '"To stay within budget" と "we should reduce external consulting hours"',
        variation_chunks: ["To stay within budget,", "we should reduce", "external consulting hours."]
      }
    ];
  }

  if (patLower.startsWith("thank you for") || patLower.startsWith("thanks for")) {
    return [
      {
        variation_prompt_jp: "【迅速なフィードバックへの対応】「迅速なフィードバックありがとうございます。直ちにドラフトを修正します」",
        variation_target: "Thank you for the prompt feedback, and we will update the draft right away.",
        variation_hint_parts: '"the prompt feedback" と "update the draft right away"',
        variation_chunks: ["Thank you for the prompt feedback,", "and we will update the draft", "right away."]
      },
      {
        variation_prompt_jp: "【明確な情報共有への感謝】「詳細な情報共有ありがとうございます。本日チーム内に周知いたします」",
        variation_target: "Thank you for the clear heads-up, and we will brief the core team today.",
        variation_hint_parts: '"the clear heads-up" と "brief the core team today"',
        variation_chunks: ["Thank you for the clear heads-up,", "and we will brief the core team", "today."]
      }
    ];
  }

  if (patLower.startsWith("i am afraid") || patLower.startsWith("i'm afraid")) {
    return [
      {
        variation_prompt_jp: "【即日対応困難時の代替案】「恐れ入りますが本日中の対応は難しいですが、明朝一番に対応可能です」",
        variation_target: "I am afraid that today is difficult, but we can deliver it first thing tomorrow.",
        variation_hint_parts: '"today is difficult" と "we can deliver it first thing tomorrow"',
        variation_chunks: ["I am afraid that today is difficult,", "but we can deliver it", "first thing tomorrow."]
      },
      {
        variation_prompt_jp: "【追加要件見送り時の代替案】「恐れ入りますが追加要件の実装は間に合いませんが、第2フェーズでの対応は可能です」",
        variation_target: "I am afraid that extra features cannot fit now, but we can plan them for Phase 2.",
        variation_hint_parts: '"extra features cannot fit now" と "we can plan them for Phase 2"',
        variation_chunks: ["I am afraid that extra features cannot fit now,", "but we can plan them", "for Phase 2."]
      }
    ];
  }

  if (patLower.startsWith("please note that")) {
    return [
      {
        variation_prompt_jp: "【承認期限の伝達】「今週中の発注手続きを進めるため、承認が本日17時までに必須となる点にご留意ください」",
        variation_target: "Please note that approval is required by 5 PM so that we can place the order this week.",
        variation_hint_parts: '"approval is required by 5 PM" と "so that we can place the order"',
        variation_chunks: ["Please note that approval is required by 5 PM", "so that we can place the order", "this week."]
      },
      {
        variation_prompt_jp: "【メンテ停止の周知】「パッチを安全に適用するため、深夜にサーバー再起動が発生する点にご留意ください」",
        variation_target: "Please note that servers will restart at midnight so that we can deploy the patch.",
        variation_hint_parts: '"servers will restart at midnight" と "so that we can deploy the patch"',
        variation_chunks: ["Please note that servers will restart at midnight", "so that we can deploy the patch."]
      }
    ];
  }

  if (patLower.startsWith("fair point") || patLower.startsWith("good point") || patLower.startsWith("that makes sense") || patLower.startsWith("that's a good point")) {
    return [
      {
        variation_prompt_jp: "【スケジュール厳守の優先】「ごもっともですが、まずは当初のスケジュールを守りましょう」",
        variation_target: "Fair point, but let's stick to the original schedule for now.",
        variation_hint_parts: '"the original schedule"（当初の予定）と "for now"（今のところは）を型に組み合わせるだけ！',
        variation_chunks: ["Fair point,", "but let's stick to", "the original schedule", "for now."]
      },
      {
        variation_prompt_jp: "【コア要件への集中】「ごもっともですが、まずは最優先の要件に絞りましょう」",
        variation_target: "Fair point, but let's stick to our core priorities first.",
        variation_hint_parts: '"our core priorities"（最優先事項）と "first"（まずは）を型に組み合わせるだけ！',
        variation_chunks: ["Fair point,", "but let's stick to", "our core priorities", "first."]
      }
    ];
  }

  if (patLower.startsWith("let's stick to") || patLower.startsWith("let's focus on")) {
    return [
      {
        variation_prompt_jp: "【進捗優先の維持】「今は当初のスケジュールを守り、予定通り進めましょう」",
        variation_target: "Let's stick to the original plan and review the results next week.",
        variation_hint_parts: '"the original plan"（当初計画）と "review the results next week"（来週確認）を組み合わせるだけ！',
        variation_chunks: ["Let's stick to", "the original plan", "and review the results", "next week."]
      },
      {
        variation_prompt_jp: "【最優先要件の推進】「まずは最重要の成果物に絞って集中しましょう」",
        variation_target: "Let's focus on the core deliverables before adding new tasks.",
        variation_hint_parts: '"the core deliverables"（中核成果物）と "before adding new tasks"（追加前）を組み合わせるだけ！',
        variation_chunks: ["Let's focus on", "the core deliverables", "before adding", "new tasks."]
      }
    ];
  }

  if (patLower.startsWith("i suggest") || patLower.startsWith("we recommend")) {
    return [
      {
        variation_prompt_jp: "【誤解防止の事前提案】「認識の食い違いを防ぐため、ドラフト仕様書を事前に共有することを提案します」",
        variation_target: "I suggest we share the draft specs in order to prevent misunderstandings.",
        variation_hint_parts: '"share the draft specs" と "in order to prevent misunderstandings"',
        variation_chunks: ["I suggest we share the draft specs", "in order to prevent", "misunderstandings."]
      },
      {
        variation_prompt_jp: "【負荷分散の提案】「チームの負荷を平準化するため、バックログを2分割することを提案します」",
        variation_target: "I suggest we divide the backlog in order to balance team workload.",
        variation_hint_parts: '"divide the backlog" と "in order to balance team workload"',
        variation_chunks: ["I suggest we divide the backlog", "in order to balance", "team workload."]
      }
    ];
  }

  // 2. 上記辞書にない未知の型に対する、高精度な文脈別スロット置換エンジン
  const replaceSlots = (pat, config) => {
    let res = pat.trim().replace(/\.\.\.$/, '').trim();
    if (res.includes('[')) {
      let vIdx = 0, nIdx = 0, pIdx = 0, tIdx = 0, gIdx = 0, cIdx = 0, fIdx = 0;
      res = res.replace(/\[(?:verb|action)[^\]]*\]/gi, () => config.verbs[vIdx++ % config.verbs.length]);
      res = res.replace(/\[(?:noun|matter|topic|item)[^\]]*\]/gi, () => config.nouns[nIdx++ % config.nouns.length]);
      res = res.replace(/\[(?:person|team|lead|manager)[^\]]*\]/gi, () => config.teams[pIdx++ % config.teams.length]);
      res = res.replace(/\[(?:time|deadline)[^\]]*\]/gi, () => config.times[tIdx++ % config.times.length]);
      res = res.replace(/\[(?:goal|risk)[^\]]*\]/gi, () => config.goals[gIdx++ % config.goals.length]);
      res = res.replace(/\[(?:clause|statement|condition)[^\]]*\]/gi, () => config.clauses[cIdx++ % config.clauses.length]);
      res = res.replace(/\[[^\]]+\]/g, () => config.fallbacks[fIdx++ % config.fallbacks.length]);
    } else {
      // 角括弧がない接頭辞・型フレーズの場合、文構造を自動補完して完全な英文（10語前後）にする
      const lower = res.toLowerCase();
      if (/\b(?:to|on|for|with|about|in|at|of|into|from)$/i.test(lower)) {
        res = `${res} ${config.nouns[0]} ${config.times[0]}`;
      } else if (/\b(?:that|if|whether|because|although|while)$/i.test(lower)) {
        res = `${res} ${config.clauses[0]}`;
      } else if (/\b(?:need to|have to|should|could|can|will|would like to|let's|must)$/i.test(lower)) {
        res = `${res} ${config.verbs[0]} ${config.times[0]}`;
      } else if (/\b(?:but|and|so|however)$/i.test(lower) || lower.endsWith(',')) {
        res = `${res} we should ${config.verbs[0]} ${config.times[0]}`;
      } else {
        const wordCount = lower.split(/\s+/).filter(Boolean).length;
        if (wordCount < 5) {
          res = `${res} so that we can ${config.goals[0]}`;
        }
      }
    }
    res = res.trim();
    if (!res.endsWith(".") && !res.endsWith("?")) res += ".";
    return res;
  };

  const config1 = {
    verbs: ["review the updated data", "verify the requirements", "schedule a sync"],
    nouns: ["the revised milestone", "the draft proposal", "the initial timeline"],
    teams: ["our project manager", "the operations lead", "our QA team"],
    times: ["by tomorrow afternoon", "by the end of this week", "before 5 PM"],
    goals: ["keep the current schedule", "avoid unexpected delays", "maintain output quality"],
    clauses: ["we receive the final sign-off", "the technical review is complete"],
    fallbacks: ["the next step", "the action item"]
  };

  const config2 = {
    verbs: ["confirm the project scope", "align on priorities", "proceed with testing"],
    nouns: ["the priority list", "the core requirements", "the agreed deliverables"],
    teams: ["the technical team", "the client coordinator", "our tech director"],
    times: ["before Friday noon", "by tomorrow morning", "early next week"],
    goals: ["ensure deliverable quality", "meet compliance standards", "stay within budget"],
    clauses: ["the client approves the budget", "we get all necessary inputs"],
    fallbacks: ["the alternative plan", "the contingency option"]
  };

  const vTarget1 = replaceSlots(cleanPat, config1);
  const vTarget2 = replaceSlots(cleanPat, config2);
  const cleanJp = (patternJp || "この型").replace(/\[.*?\]/g, "〜");

  return [
    {
      variation_prompt_jp: `【実務応用 1/2: スケジュール調整】「${cleanJp}」の型で進捗や日程を伝える時：`,
      variation_target: vTarget1,
      variation_hint_parts: "型をそのまま固定し、日程やレビューのパーツを当てはめるだけ！",
      variation_chunks: createSentenceChunks(vTarget1)
    },
    {
      variation_prompt_jp: `【実務応用 2/2: スコープ・優先度調整】「${cleanJp}」の型で別条件を提示する時：`,
      variation_target: vTarget2,
      variation_hint_parts: "型を固定したまま、スコープや優先度のパーツに入れ替えてみよう！",
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
15. "closing_choices": Exactly 2 fast 1-tap options to close the conversation after counterpart's reaction:
    - 1 choice with is_correct: true (natural, polite closing confirming agreement/next step, e.g. "Sounds great, thank you! I'll send you an email recap.")
    - 1 choice with is_correct: false (abrupt, awkward, or overly passive closing, e.g. "Okay, bye." or "Fine, see you later.")
    - Each option must include "text", "jp", "is_correct", and "feedback".
16. "choices": Exactly 3 distinct choices:
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
        closing_choices: {
          type: Type.ARRAY,
          description: "2 options for 1-tap closing reply: one natural/collaborative closing (is_correct=true) and one abrupt/unnatural closing (is_correct=false)",
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "English closing statement" },
              jp: { type: Type.STRING, description: "Japanese translation" },
              is_correct: { type: Type.BOOLEAN, description: "True if natural closing, false if abrupt/unnatural" },
              feedback: { type: Type.STRING, description: "Brief Japanese explanation of why this closing works or fails" }
            },
            required: ["text", "jp", "is_correct", "feedback"]
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
          
          // Only keep variations that actually contain the key pattern stem and are complete sentences (not just the pattern)
          let validVariations = rawVariations.filter(v => {
            if (!v || !v.variation_target) return false;
            const targetLower = v.variation_target.toLowerCase().trim();
            const wordCount = targetLower.split(/\s+/).filter(Boolean).length;
            if (wordCount <= 4 || targetLower.length < 24) return false;
            if (targetLower.includes('to this') || targetLower.endsWith(' to this.') || targetLower.endsWith(' to this?')) return false;

            const cleanPat = (sc.key_pattern || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanTarget = targetLower.replace(/[^a-z0-9]/g, '');
            if (cleanPat.length > 0 && cleanPat === cleanTarget) return false;

            if (!patternStem) return true;
            return targetLower.includes(patternStem);
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
            closing_choices: Array.isArray(sc.closing_choices) && sc.closing_choices.length >= 2 ? sc.closing_choices : null,
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
