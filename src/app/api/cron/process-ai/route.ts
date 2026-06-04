import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const deepseekTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? "45000");
const degradedPlaceholders = [
  "本条新闻已进入 AI 降级模式，当前为自动分析结果。",
  "暂无 AI 深度解析，系统将在下一次同步时自动补全。",
];
const aiSystemPrompt = `你是一位资深的全球宏观与行业策略分析师（SFC/CFA持牌）。
你必须输出高含金量、可执行、方向明确的策略分析，不允许空话。

硬性规则：
1) 只返回合法 JSON 对象，不返回 Markdown、代码块、解释文本。
2) 严格按用户给定字段输出，不得缺字段，不得新增字段。
3) 所有字段必须为字符串，sentiment 仅可为 positive/negative/neutral。
4) 不得输出 null、undefined、空字符串。`;

interface PendingArticleRow {
  id: string;
  title_en?: string | null;
  content_en?: string | null;
  title?: string | null;
  content?: string | null;
}

interface LlmAnalysisResult {
  translated_title: string;
  translated_content: string;
  summary: string;
  deep_analysis: string;
  investment_advice: string;
  sentiment: "positive" | "negative" | "neutral" | string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  );
}

function getSupabaseWriteKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    return joined.length > 0 ? joined : null;
  }
  if (value && typeof value === "object") {
    try {
      const text = JSON.stringify(value).trim();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeSentiment(value: string | null): "positive" | "negative" | "neutral" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "positive" || normalized === "negative" || normalized === "neutral") {
    return normalized;
  }
  return "neutral";
}

function sentimentToImpact(sentiment: "positive" | "negative" | "neutral"): string {
  if (sentiment === "positive") return "偏多";
  if (sentiment === "negative") return "偏空";
  return "中性";
}

function isCronRequestAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const normalizeCandidate = (raw: string | null | undefined) => {
    if (!raw) return "";
    let candidate = raw.trim();
    candidate = candidate.replace(/^Bearer\s+/i, "").trim();
    if (
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
      candidate = candidate.slice(1, -1).trim();
    }
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded) candidate = decoded;
    } catch {
      // keep original if decode fails
    }
    return candidate;
  };

  const xCronSecret = normalizeCandidate(request.headers.get("x-cron-secret"));
  if (xCronSecret === expectedSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    const url = new URL(request.url);
    const querySecret = (
      url.searchParams.get("cron_secret") ??
      url.searchParams.get("secret") ??
      ""
    ).trim();
    return normalizeCandidate(querySecret) === expectedSecret;
  }

  const authSecret = normalizeCandidate(authHeader);
  if (authSecret === expectedSecret) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = (
    url.searchParams.get("cron_secret") ??
    url.searchParams.get("secret") ??
    ""
  ).trim();
  return normalizeCandidate(querySecret) === expectedSecret;
}

function normalizeBaseUrl(input: string): string {
  const stripped = input.trim().replace(/^['"]|['"]$/g, "");
  try {
    const parsed = new URL(stripped);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    throw new Error(`Invalid DEEPSEEK_BASE_URL: ${stripped}`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function extractJsonFromText(text: string): string {
  const withoutFence = text.replace(/```json|```/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("DeepSeek did not return valid JSON");
  }
  return withoutFence.slice(start, end + 1);
}

function buildPrompt(title: string, content: string) {
  return `你是一位资深的全球宏观与行业策略分析师（SFC/CFA持牌）。请处理以下英文新闻，通过严密的宏观推演和行业微观拆解，输出高含金量的策略分析 JSON。

【新闻输入】
新闻标题: ${title}
新闻正文: ${content}

【处理与推理要求】
1. 翻译标准：必须将标题和正文转化为专业中文金融术语，正文控制在 600 字内。
2. 逻辑密度：杜绝“市场将维持震荡/值得关注”等无方向的空话，必须给出确定性的逻辑传导和资产方向。
3. 格式规范：只返回合法 JSON，不要包含任何 Markdown 格式标记（如 \`\`\`json），不要包含任何额外解释文本。

【返回格式要求】
严格仅返回以下结构的 JSON 对象，各字段内部须严格执行规定的句式和排版标签：

{
  "translated_title": "精准的中文金融标题",
  "translated_content": "专业、凝练的中文正文（不超过600字）",
  "summary": "💡 [第一句用最硬核的金融事实开篇，拒绝长难句] ➜ [第二句点明该事件对美股/A股/港股核心板块的直接、边际影响。字数控制在 120~180 字之间。]",
  "deep_analysis": "📊 【行业/宏观深层逻辑】\\n一针见血指出事件背后的结构性矛盾或核心变量分化。\\n\\n📈 【核心资产传导路径】\\n• 股票/相关板块 ➜ [利空/利好/中性] [强/弱] [短期/中期]，影响路径：[15字内简述逻辑]\\n• 大宗商品或本国汇率 ➜ [利空/利好/中性] [强/弱] [短期/中期]，影响路径：[15字内简述逻辑]\\n\\n⚠️ 【边界与结论】\\n阐明核心逻辑失效的一个反例条件。结尾必须强制以：‘结论：短期(1-5日)看[涨/跌]，中期(1-4周)防范[具体风险]’结束。",
  "investment_advice": "1. ⚖️ 仓位与执行：[给出明确的仓位建议、触发条件（如：跌破某均线）以及风控止损线]\\n2. 🔄 对冲与配置：[提供跨资产对冲方案或防御型资产配置方案]\\n3. 🚨 风险提示：[作为最后一条，强制给出该策略面临的最大黑天鹅潜在风险点，不与前文重复]",
  "sentiment": "positive | negative | neutral"
}`;
}

function escapeFilterValue(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/,/g, "\\,")}"`;
}

function pendingFilterWithPlaceholder() {
  const parts = ["deep_analysis_zh.is.null"];
  for (const placeholder of degradedPlaceholders) {
    parts.push(`deep_analysis_zh.eq.${escapeFilterValue(placeholder)}`);
  }
  return parts.join(",");
}

function isMissingColumnError(message: string, columnName: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    normalized.includes("does not exist") &&
    normalized.includes(columnName.toLowerCase())
  );
}

function isMissingAnyColumnError(message: string, columnNames: string[]): boolean {
  return columnNames.some((columnName) => isMissingColumnError(message, columnName));
}

async function queryPendingWithQueue(
  supabase: SupabaseClient,
  selectColumns: string
) {
  return supabase
    .from("articles")
    .select(selectColumns)
    .eq("ai_status", "pending")
    .or(pendingFilterWithPlaceholder())
    .order("created_at", { ascending: true })
    .limit(1);
}

async function queryPendingWithoutQueue(
  supabase: SupabaseClient,
  selectColumns: string,
  includeDeepAnalysisFilter: boolean
) {
  let query = supabase
    .from("articles")
    .select(selectColumns)
    .order("created_at", { ascending: true })
    .limit(1);
  if (includeDeepAnalysisFilter) {
    query = query.is("deep_analysis_zh", null);
  }
  return query;
}

function toPendingRows(data: unknown): PendingArticleRow[] {
  return Array.isArray(data) ? (data as unknown as PendingArticleRow[]) : [];
}

async function fetchPendingRows(
  supabase: SupabaseClient
): Promise<{ rows: PendingArticleRow[]; queueSupported: boolean }> {
  const modernColumns = "id,title_en,content_en";
  const legacyColumns = "id,title,content";

  const modernQueue = await queryPendingWithQueue(supabase, modernColumns);
  if (!modernQueue.error) {
    return {
      rows: toPendingRows(modernQueue.data),
      queueSupported: true,
    };
  }

  const canTryLegacyQueueColumns = isMissingAnyColumnError(modernQueue.error.message, [
    "title_en",
    "content_en",
  ]);
  if (canTryLegacyQueueColumns) {
    const legacyQueue = await queryPendingWithQueue(supabase, legacyColumns);
    if (!legacyQueue.error) {
      return {
        rows: toPendingRows(legacyQueue.data),
        queueSupported: true,
      };
    }

    const missingQueueColumns = isMissingAnyColumnError(legacyQueue.error.message, [
      "ai_status",
      "deep_analysis_zh",
    ]);
    if (!missingQueueColumns) {
      throw new Error(legacyQueue.error.message);
    }
  } else {
    const missingQueueColumns = isMissingAnyColumnError(modernQueue.error.message, [
      "ai_status",
      "deep_analysis_zh",
    ]);
    if (!missingQueueColumns) {
      throw new Error(modernQueue.error.message);
    }
  }

  // Legacy fallback: no queue columns yet, process earliest row.
  const modernLegacyFiltered = await queryPendingWithoutQueue(supabase, modernColumns, true);
  if (!modernLegacyFiltered.error) {
    return {
      rows: toPendingRows(modernLegacyFiltered.data),
      queueSupported: false,
    };
  }

  const canTryLegacyFilteredColumns = isMissingAnyColumnError(modernLegacyFiltered.error.message, [
    "title_en",
    "content_en",
  ]);
  if (canTryLegacyFilteredColumns) {
    const legacyFiltered = await queryPendingWithoutQueue(supabase, legacyColumns, true);
    if (!legacyFiltered.error) {
      return {
        rows: toPendingRows(legacyFiltered.data),
        queueSupported: false,
      };
    }
    if (!isMissingColumnError(legacyFiltered.error.message, "deep_analysis_zh")) {
      throw new Error(legacyFiltered.error.message);
    }

    const legacyFinal = await queryPendingWithoutQueue(supabase, legacyColumns, false);
    if (legacyFinal.error) {
      throw new Error(legacyFinal.error.message);
    }
    return {
      rows: toPendingRows(legacyFinal.data),
      queueSupported: false,
    };
  }

  if (!isMissingColumnError(modernLegacyFiltered.error.message, "deep_analysis_zh")) {
    throw new Error(modernLegacyFiltered.error.message);
  }

  const modernFinal = await queryPendingWithoutQueue(supabase, modernColumns, false);
  if (modernFinal.error) {
    throw new Error(modernFinal.error.message);
  }
  return { rows: toPendingRows(modernFinal.data), queueSupported: false };
}

async function handleProcessAi(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(getSupabaseUrl(), getSupabaseWriteKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let pendingRows: PendingArticleRow[] = [];
  let queueSupported = true;
  try {
    const result = await fetchPendingRows(supabase);
    pendingRows = result.rows;
    queueSupported = result.queueSupported;
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }

  if (!pendingRows || pendingRows.length === 0) {
    return NextResponse.json({ success: true, message: "no pending tasks" });
  }

  const target = pendingRows[0] as PendingArticleRow;
  if (queueSupported) {
    const { data: lockRows, error: lockError } = await supabase
      .from("articles")
      .update({ ai_status: "processing", ai_error: null })
      .eq("id", target.id)
      .eq("ai_status", "pending")
      .select("id")
      .limit(1);

    if (lockError) {
      return NextResponse.json({ error: lockError.message }, { status: 500 });
    }

    if (!lockRows || lockRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "task was locked by another worker",
      });
    }
  }

  const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
  const deepseekBaseUrl = normalizeBaseUrl(
    process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1"
  );
  const deepseekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const openai = new OpenAI({
    apiKey: deepseekApiKey,
    baseURL: deepseekBaseUrl,
  });

  const title = (target.title_en ?? target.title ?? "").trim() || "Untitled";
  const content = (target.content_en ?? target.content ?? title).trim();

  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: deepseekModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: aiSystemPrompt },
          { role: "user", content: buildPrompt(title, content) },
        ],
      }),
      deepseekTimeoutMs,
      `DeepSeek timed out after ${deepseekTimeoutMs}ms`
    );

    const rawMessage = completion.choices[0]?.message?.content;
    const text =
      typeof rawMessage === "string"
        ? rawMessage.trim()
        : JSON.stringify(rawMessage ?? "").trim();
    const parsed = JSON.parse(extractJsonFromText(text)) as Partial<LlmAnalysisResult>;

    const deepAnalysis = toOptionalTrimmedText(parsed.deep_analysis);
    const investmentAdvice = toOptionalTrimmedText(parsed.investment_advice);
    const summary = toOptionalTrimmedText(parsed.summary);
    const translatedTitle = toOptionalTrimmedText(parsed.translated_title);
    const translatedContent = toOptionalTrimmedText(parsed.translated_content);
    const sentiment = normalizeSentiment(toOptionalTrimmedText(parsed.sentiment));
    const impact = sentimentToImpact(sentiment);

    if (!deepAnalysis || !investmentAdvice) {
      throw new Error("DeepSeek returned incomplete analysis fields");
    }

    const modernPayload: Record<string, unknown> = {
      deep_analysis_zh: deepAnalysis,
      investment_advice_zh: investmentAdvice,
      impact,
      analysis_json: {
        translated_title: translatedTitle ?? "",
        translated_content: translatedContent ?? "",
        summary,
        deep_analysis: deepAnalysis,
        investment_advice: investmentAdvice,
        sentiment,
      },
    };
    if (queueSupported) {
      modernPayload.ai_status = "completed";
      modernPayload.ai_error = null;
    }

    if (summary) modernPayload.summary_zh = summary;
    if (translatedTitle) modernPayload.title_zh = translatedTitle;
    if (translatedContent) modernPayload.content_zh = translatedContent;

    const { error: modernUpdateError } = await supabase
      .from("articles")
      .update(modernPayload)
      .eq("id", target.id);

    if (!modernUpdateError) {
      return NextResponse.json({
        success: true,
        message: "processed 1 task",
        article_id: target.id,
      });
    }

    const shouldFallbackLegacy = isMissingAnyColumnError(modernUpdateError.message, [
      "deep_analysis_zh",
      "investment_advice_zh",
      "summary_zh",
      "title_zh",
      "content_zh",
      "analysis_json",
      "impact",
    ]);
    if (!shouldFallbackLegacy) {
      throw new Error(modernUpdateError.message);
    }

    const legacyPayload: Record<string, unknown> = {
      deep_analysis: deepAnalysis,
      investment_advice: investmentAdvice,
      impact,
      analysis_json: {
        translated_title: translatedTitle ?? "",
        translated_content: translatedContent ?? "",
        summary,
        deep_analysis: deepAnalysis,
        investment_advice: investmentAdvice,
        sentiment,
      },
    };
    if (summary) legacyPayload.summary = summary;
    if (translatedTitle) legacyPayload.translated_title = translatedTitle;
    if (translatedContent) legacyPayload.translated_content = translatedContent;

    const { error: legacyUpdateError } = await supabase
      .from("articles")
      .update(legacyPayload)
      .eq("id", target.id);

    if (legacyUpdateError) {
      const shouldRetryWithoutJsonColumns = isMissingAnyColumnError(legacyUpdateError.message, [
        "analysis_json",
        "impact",
      ]);
      if (!shouldRetryWithoutJsonColumns) {
        throw new Error(legacyUpdateError.message);
      }

      delete legacyPayload.analysis_json;
      delete legacyPayload.impact;
      const { error: legacyRetryError } = await supabase
        .from("articles")
        .update(legacyPayload)
        .eq("id", target.id);
      if (legacyRetryError) {
        throw new Error(legacyRetryError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "processed 1 task",
      article_id: target.id,
    });
  } catch (error) {
    const reason = getErrorMessage(error);
    console.error("[process-ai] Failed to process article", {
      articleId: target.id,
      reason,
    });

    if (queueSupported) {
      await supabase
        .from("articles")
        .update({ ai_status: "failed", ai_error: reason })
        .eq("id", target.id);
    }

    return NextResponse.json(
      {
        success: false,
        message: "AI processing failed (captured for retry)",
        error: reason,
        article_id: target.id,
      }
    );
  }
}

export async function GET(request: Request) {
  return handleProcessAi(request);
}

export async function POST(request: Request) {
  return handleProcessAi(request);
}
