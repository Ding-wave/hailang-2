import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const newsFetchLimit = Number(process.env.NEWS_FETCH_LIMIT ?? "3");
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? "45000");
const translationBackfillLimit = Number(process.env.TRANSLATION_BACKFILL_LIMIT ?? "6");
const maxProcessLimit = 10;

interface GnewsArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string | null };
}

interface LlmAnalysisResult {
  translated_title: string;
  translated_content: string;
  summary: string;
  deep_analysis: string;
  investment_advice: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface UpsertResult {
  error: { message: string } | null;
}

interface ExistingArticleRow {
  title_en?: string | null;
  content_en?: string | null;
  title_zh?: string | null;
  content_zh?: string | null;
  summary_zh?: string | null;
  deep_analysis_zh?: string | null;
  investment_advice_zh?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  title?: string | null;
  content?: string | null;
  translated_title?: string | null;
  translated_content?: string | null;
  summary?: string | null;
  deep_analysis?: string | null;
  investment_advice?: string | null;
  source?: string | null;
  url?: string | null;
  image?: string | null;
}

interface FetchRequestOptions {
  fetchLimit: number;
  backfillLimit: number;
  reprocessLatest: number;
  reprocessOnly: boolean;
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

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), llmTimeoutMs)
    ),
  ]);
}

function extractJsonFromText(text: string): string {
  const withoutFence = text.replace(/```json|```/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM did not return valid JSON");
  }
  return withoutFence.slice(start, end + 1);
}

function normalizeSentiment(value: string): "positive" | "negative" | "neutral" {
  if (value === "positive" || value === "negative" || value === "neutral") {
    return value;
  }
  return "neutral";
}

function looksLikeChinese(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  const cjkChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return cjkChars >= Math.max(4, Math.floor(text.length * 0.08));
}

function trimTo(input: string, max: number): string {
  return input.length > max ? `${input.slice(0, max)}...` : input;
}

async function translateViaMyMemory(text: string): Promise<string | null> {
  const source = text.trim();
  if (!source) return null;

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", source);
  url.searchParams.set("langpair", "en|zh-CN");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated || !looksLikeChinese(translated)) {
      return null;
    }
    return translated;
  } catch {
    return null;
  }
}

async function buildFallbackAnalysis(
  article: GnewsArticle,
  reason: string
): Promise<LlmAnalysisResult> {
  const originalText = article.content || article.description || article.title;
  const translatedTitle =
    (await translateViaMyMemory(trimTo(article.title, 300))) ??
    `【待优化翻译】${article.title}`;
  const translatedContent =
    (await translateViaMyMemory(trimTo(originalText, 800))) ??
    `原文要点（待优化翻译）：${trimTo(originalText, 520)}`;

  const deepAnalysis = [
    "本条新闻已进入 AI 降级模式，当前为自动分析结果。",
    "短期看，消息面会先影响相关板块风险偏好，波动可能上升。",
    "若后续出现政策或业绩验证，股票与汇率资产可能出现方向分化。",
    "债券与大宗商品需要结合通胀、增长与美元变化联动判断。",
    "综合来看，当前建议以中性观察为主，等待更多确认信号。",
  ].join("");

  const investmentAdvice = [
    "1. 优先控制仓位，避免在单条新闻驱动下追涨杀跌。",
    "2. 关注同主题资产联动，等待二次确认后再加仓。",
    "3. 对高波动品种设置止损线，并预留流动性缓冲。",
    "4. 风险提示：市场存在不确定性，以上仅供参考不构成投资建议。",
  ].join("\n");

  return {
    translated_title: translatedTitle,
    translated_content: translatedContent,
    summary: `新闻要点：${trimTo(translatedContent, 140)}`,
    deep_analysis: deepAnalysis,
    investment_advice: `${investmentAdvice}\n（降级原因：${trimTo(reason, 120)}）`,
    sentiment: "neutral",
  };
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function parseDateOrNow(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function clampPositiveInt(value: unknown, fallback: number, max = maxProcessLimit): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function clampNonNegativeInt(value: unknown, fallback: number, max = maxProcessLimit): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

async function parseFetchRequestOptions(request: Request): Promise<FetchRequestOptions> {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  let body: Record<string, unknown> = {};

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
    }
  }

  const fetchLimit = clampPositiveInt(
    body.fetch_limit ?? searchParams.get("fetch_limit"),
    Math.min(Math.max(newsFetchLimit, 1), maxProcessLimit)
  );
  const rawBackfillLimit = body.backfill_limit ?? searchParams.get("backfill_limit");
  const reprocessLatest = clampPositiveInt(
    body.reprocess_latest ?? searchParams.get("reprocess_latest"),
    0
  );
  const reprocessOnly = parseBoolean(
    body.reprocess_only ?? searchParams.get("reprocess_only"),
    false
  );
  const hasCustomBackfillLimit =
    rawBackfillLimit !== null &&
    rawBackfillLimit !== undefined &&
    String(rawBackfillLimit).trim() !== "";
  const backfillLimit = hasCustomBackfillLimit
    ? clampNonNegativeInt(rawBackfillLimit, 0, maxProcessLimit)
    : reprocessOnly
      ? 0
      : Math.min(Math.max(translationBackfillLimit, 0), maxProcessLimit);

  return {
    fetchLimit,
    backfillLimit,
    reprocessLatest,
    reprocessOnly,
  };
}

function needsAnalysisBackfill(row: ExistingArticleRow): boolean {
  const translatedTitle = firstNonEmpty(row.title_zh, row.translated_title);
  const translatedContent = firstNonEmpty(row.content_zh, row.translated_content);
  const summary = firstNonEmpty(row.summary_zh, row.summary);
  const deepAnalysis = firstNonEmpty(row.deep_analysis_zh, row.deep_analysis);
  const investmentAdvice = firstNonEmpty(
    row.investment_advice_zh,
    row.investment_advice
  );

  return (
    !translatedTitle ||
    !translatedContent ||
    !summary ||
    !deepAnalysis ||
    !investmentAdvice ||
    !looksLikeChinese(translatedTitle) ||
    !looksLikeChinese(translatedContent) ||
    !looksLikeChinese(summary) ||
    !looksLikeChinese(deepAnalysis) ||
    !looksLikeChinese(investmentAdvice)
  );
}

function mapStoredArticleToGnewsArticle(row: ExistingArticleRow): GnewsArticle | null {
  const url = firstNonEmpty(row.source_url, row.url);
  if (!url) return null;

  const title = firstNonEmpty(row.title_en, row.title, "Untitled");
  const content = firstNonEmpty(row.content_en, row.content, title);

  return {
    title,
    description: content,
    content,
    url,
    image: firstNonEmpty(row.image_url, row.image) || null,
    publishedAt: parseDateOrNow(row.published_at ?? row.created_at),
    source: {
      name: firstNonEmpty(row.source_name, row.source, "Unknown"),
      url: null,
    },
  };
}

function shouldRetryWithLegacySchema(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("on_conflict")
  );
}

function isCronRequestAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const xCronSecret = request.headers.get("x-cron-secret");
  if (xCronSecret === expectedSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expectedSecret}`) {
    return true;
  }

  return false;
}

async function processWithDeepSeek(
  client: OpenAI,
  article: GnewsArticle
): Promise<LlmAnalysisResult> {
  const modelName = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const originalText = article.content || article.description || article.title;

  const prompt = `你是一位资深的全球宏观与行业策略分析师（SFC/CFA持牌）。请处理以下英文新闻，通过严密的宏观推演和行业微观拆解，输出高含金量的策略分析 JSON。

【新闻输入】
新闻标题: ${article.title}
新闻正文: ${originalText}

【处理与推理要求】
1. 翻译标准：必须将标题和正文转化为专业中文金融术语，正文控制在 600 字内。
2. 逻辑密度：杜绝“市场将维持震荡/值得关注”等无方向的空话，必须给出确定性的逻辑传导和资产方向。
3. 格式规范：只返回合法 JSON，不要包含任何 Markdown 格式标记（如 \`\`\`json），不要包含任何原生换行符转义。

【返回格式要求】
严格仅返回以下结构的 JSON 对象，各字段内部须严格执行规定的句式和排版标签：
{
  "translated_title": "精准的中文金融标题",
  "translated_content": "专业、凝练的中文正文（不超过600字）",
  "summary": "💡 [第一句用最硬核的金融事实开篇，拒绝长难句] ➜ [第二句点明该事件对美股/A股/港股核心板块的直接、边际影响。字数控制在 120~180 字之间。]",
  "deep_analysis": "📊 【行业/宏观深层逻辑】一针见血指出事件背后的结构性矛盾或核心变量分化。📈 【核心资产传导路径】• 股票/相关板块 ➜ [利空/利好/中性] [强/弱] [短期/中期]，影响路径：[15字内简述逻辑]• 大宗商品或本国汇率 ➜ [利空/利好/中性] [强/弱] [短期/中期]，影响路径：[15字内简述逻辑]⚠️ 【边界与结论】阐明核心逻辑失效的一个反例条件。结尾必须强制以：‘结论：短期(1-5日)看[涨/跌]，中期(1-4周)防范[具体风险]’结束。",
  "investment_advice": "1. ⚖️ 仓位与执行：[给出明确的仓位建议、触发条件（如：跌破某均线）以及风控止损线]2. 🔄 对冲与配置：[提供跨资产对冲方案或防御型资产配置方案]3. 🚨 风险提示：[作为最后一条，强制给出该策略面临的最大黑天鹅潜在风险点，不与前文重复]",
  "sentiment": "positive" | "negative" | "neutral"
}`;

  let parsed: LlmAnalysisResult | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "user",
            content:
              attempt === 0
                ? prompt
                : `${prompt}\n\n上次输出不符合要求。请严格确保输出字段完整、全部为中文、且只返回合法 JSON。`,
          },
        ],
      });
      const messageContent = result.choices[0]?.message?.content;
      const text =
        typeof messageContent === "string"
          ? messageContent.trim()
          : JSON.stringify(messageContent ?? "").trim();
      parsed = JSON.parse(extractJsonFromText(text)) as LlmAnalysisResult;

      const summary = parsed.summary?.trim() || "";
      const deepAnalysis = parsed.deep_analysis?.trim() || "";
      const investmentAdvice = parsed.investment_advice?.trim() || "";
      const translatedTitle = parsed.translated_title?.trim() || "";
      const translatedContent = parsed.translated_content?.trim() || "";

      if (
        !looksLikeChinese(translatedTitle) ||
        !looksLikeChinese(translatedContent) ||
        !looksLikeChinese(summary) ||
        !looksLikeChinese(deepAnalysis) ||
        !looksLikeChinese(investmentAdvice)
      ) {
        throw new Error("DeepSeek returned non-Chinese output");
      }

      parsed.summary = summary;
      parsed.deep_analysis = deepAnalysis;
      parsed.investment_advice = investmentAdvice;
      parsed.translated_title = translatedTitle;
      parsed.translated_content = translatedContent;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!parsed) {
    throw lastError instanceof Error
      ? lastError
      : new Error("DeepSeek output parsing failed");
  }

  return {
    translated_title: parsed.translated_title?.trim() || "（待补全翻译）" + article.title,
    translated_content:
      parsed.translated_content?.trim() || "（待补全翻译）" + originalText,
    summary: parsed.summary?.trim() || "暂无新闻总结，系统将在下一次同步时自动补全。",
    deep_analysis:
      parsed.deep_analysis?.trim() ||
      "暂无 AI 深度解析，系统将在下一次同步时自动补全。",
    investment_advice:
      parsed.investment_advice?.trim() ||
      "1. 暂无投资建议。\n2. 请等待系统补全后再做决策。\n3. 投资有风险，入市需谨慎。",
    sentiment: normalizeSentiment(parsed.sentiment),
  };
}

async function fetchBackfillCandidates(
  supabase: SupabaseClient,
  limit: number
): Promise<GnewsArticle[]> {
  if (limit <= 0) return [];

  const scanCount = Math.min(Math.max(limit * 5, 20), 120);

  const {
    data: byPublishedAt,
    error: publishedAtError,
  } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(scanCount);

  const {
    data: byCreatedAt,
    error: createdAtError,
  } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(scanCount);

  const rows = (
    byPublishedAt ??
    byCreatedAt ??
    (!publishedAtError && !createdAtError ? [] : [])
  ) as ExistingArticleRow[];
  const seen = new Set<string>();
  const candidates: GnewsArticle[] = [];

  for (const row of rows) {
    if (!needsAnalysisBackfill(row)) continue;
    const article = mapStoredArticleToGnewsArticle(row);
    if (!article || seen.has(article.url)) continue;
    seen.add(article.url);
    candidates.push(article);
    if (candidates.length >= limit) break;
  }

  return candidates;
}

async function fetchLatestCandidates(
  supabase: SupabaseClient,
  limit: number
): Promise<GnewsArticle[]> {
  if (limit <= 0) return [];

  const {
    data: byPublishedAt,
    error: publishedAtError,
  } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit * 2);

  const {
    data: byCreatedAt,
    error: createdAtError,
  } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  const rows = (
    byPublishedAt ??
    byCreatedAt ??
    (!publishedAtError && !createdAtError ? [] : [])
  ) as ExistingArticleRow[];

  const seen = new Set<string>();
  const candidates: GnewsArticle[] = [];

  for (const row of rows) {
    const article = mapStoredArticleToGnewsArticle(row);
    if (!article || seen.has(article.url)) continue;
    seen.add(article.url);
    candidates.push(article);
    if (candidates.length >= limit) break;
  }

  return candidates;
}

async function upsertArticleWithSchemaFallback(
  supabase: SupabaseClient,
  article: GnewsArticle,
  analysisData: LlmAnalysisResult,
  originalText: string,
  impact: string
): Promise<UpsertResult> {
  const articlesTable = supabase.from("articles");

  const nextSchemaPayload = {
    source_url: article.url,
    title_en: article.title?.trim() || "Untitled",
    content_en: originalText,
    title_zh: analysisData.translated_title,
    content_zh: analysisData.translated_content,
    summary_zh: analysisData.summary,
    deep_analysis_zh: analysisData.deep_analysis,
    investment_advice_zh: analysisData.investment_advice,
    source_name: article.source?.name || "Unknown",
    image_url: article.image,
    published_at: article.publishedAt,
    impact,
    analysis_json: {
      sentiment: analysisData.sentiment,
      summary: analysisData.summary,
      deep_analysis: analysisData.deep_analysis,
      investment_advice: analysisData.investment_advice,
      translated_title: analysisData.translated_title,
      translated_content: analysisData.translated_content,
    },
  };

  const nextResult = await articlesTable.upsert(nextSchemaPayload, {
    onConflict: "source_url",
  });

  if (!nextResult.error) {
    return { error: null };
  }

  if (!shouldRetryWithLegacySchema(nextResult.error.message)) {
    return { error: { message: nextResult.error.message } };
  }

  const legacyPayload = {
    url: article.url,
    title: article.title?.trim() || "Untitled",
    original_title: article.title?.trim() || "Untitled",
    content: originalText,
    translated_title: analysisData.translated_title,
    translated_content: analysisData.translated_content,
    summary: analysisData.summary,
    deep_analysis: analysisData.deep_analysis,
    investment_advice: analysisData.investment_advice,
    sentiment: analysisData.sentiment,
    source: article.source?.name || "Unknown",
    image: article.image,
    published_at: article.publishedAt,
  };

  const legacyResult = await articlesTable.upsert(legacyPayload, {
    onConflict: "url",
  });

  return legacyResult.error
    ? { error: { message: legacyResult.error.message } }
    : { error: null };
}

async function handleFetchNews(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    fetched: 0,
    skipped: 0,
    processed: 0,
    upserted: 0,
    backfilled: 0,
    fallback_used: 0,
    backfill_candidates: 0,
    reprocessed: 0,
    errors: [] as string[],
  };

  try {
    const options = await parseFetchRequestOptions(request);
    const supabaseUrl = getSupabaseUrl();
    const supabaseWriteKey = getSupabaseWriteKey();
    const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
    const deepseekBaseUrl =
      process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

    const supabase = createClient(supabaseUrl, supabaseWriteKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const deepseekClient = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: deepseekBaseUrl,
    });

    const seenUrls = new Set<string>();

    const processOneArticle = async (article: GnewsArticle, label: string) => {
      let analysisData: LlmAnalysisResult;
      try {
        analysisData = await withTimeout(
          processWithDeepSeek(deepseekClient, article),
          `DeepSeek timed out after ${llmTimeoutMs}ms`
        );
        results.processed++;
      } catch (err) {
        const reason = getErrorMessage(err);
        results.errors.push(`DeepSeek ${label} error for "${article.title}": ${reason}`);
        analysisData = await buildFallbackAnalysis(article, reason);
        results.fallback_used++;
      }

      const originalText = article.content || article.description || article.title;
      const sentiment = analysisData.sentiment;
      const impact =
        sentiment === "positive"
          ? "偏多"
          : sentiment === "negative"
            ? "偏空"
            : "中性";

      const { error } = await upsertArticleWithSchemaFallback(
        supabase,
        article,
        analysisData,
        originalText,
        impact
      );

      if (error) {
        results.errors.push(`${label} upsert error for "${article.title}": ${error.message}`);
      } else {
        results.upserted++;
      }
    };

    if (options.reprocessLatest > 0) {
      const reprocessCandidates = await fetchLatestCandidates(
        supabase,
        options.reprocessLatest
      );
      for (let i = 0; i < reprocessCandidates.length; i++) {
        const article = reprocessCandidates[i];
        if (seenUrls.has(article.url)) continue;
        seenUrls.add(article.url);
        if (i > 0) await delay(300);
        await processOneArticle(article, "reprocess");
        results.reprocessed++;
      }
    }

    if (!options.reprocessOnly) {
      const gnewsApiKey = requireEnv("GNEWS_API_KEY");
      const gnewsUrl = new URL("https://gnews.io/api/v4/top-headlines");
      gnewsUrl.searchParams.set("category", "business");
      gnewsUrl.searchParams.set("lang", "en");
      gnewsUrl.searchParams.set("country", "us");
      gnewsUrl.searchParams.set("max", String(options.fetchLimit));
      gnewsUrl.searchParams.set("apikey", gnewsApiKey);

      const gnewsRes = await fetch(gnewsUrl.toString(), { cache: "no-store" });

      if (!gnewsRes.ok) {
        return Response.json(
          { error: `Gnews fetch failed: ${gnewsRes.status}` },
          { status: 500 }
        );
      }

      const gnewsData = await gnewsRes.json();
      const rawArticles: GnewsArticle[] = gnewsData.articles ?? [];
      const articles = rawArticles.filter((article) => {
        if (!article?.url || seenUrls.has(article.url)) {
          return false;
        }
        seenUrls.add(article.url);
        return true;
      });
      results.fetched = rawArticles.length;
      results.skipped = rawArticles.length - articles.length;

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        if (i > 0) {
          await delay(500);
        }
        await processOneArticle(article, "fetch");
      }
    }

    const backfillCandidates = await fetchBackfillCandidates(supabase, options.backfillLimit);
    results.backfill_candidates = backfillCandidates.length;

    for (let i = 0; i < backfillCandidates.length; i++) {
      const article = backfillCandidates[i];
      if (seenUrls.has(article.url)) {
        continue;
      }
      seenUrls.add(article.url);

      await delay(300);

      let analysisData: LlmAnalysisResult;
      try {
        analysisData = await withTimeout(processWithDeepSeek(deepseekClient, article), `DeepSeek timed out after ${llmTimeoutMs}ms`);
        results.processed++;
      } catch (err) {
        const reason = getErrorMessage(err);
        results.errors.push(
          `DeepSeek backfill error for "${article.title}": ${reason}`
        );
        analysisData = await buildFallbackAnalysis(article, reason);
        results.fallback_used++;
      }

      const originalText = article.content || article.description || article.title;
      const sentiment = analysisData.sentiment;
      const impact =
        sentiment === "positive"
          ? "偏多"
          : sentiment === "negative"
            ? "偏空"
            : "中性";

      const { error } = await upsertArticleWithSchemaFallback(
        supabase,
        article,
        analysisData,
        originalText,
        impact
      );

      if (error) {
        results.errors.push(
          `Backfill upsert error for "${article.title}": ${error.message}`
        );
      } else {
        results.upserted++;
        results.backfilled++;
      }
    }

    return Response.json({
      success: results.errors.length === 0,
      results,
    });
  } catch (err) {
    return Response.json(
      { error: getErrorMessage(err), results },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleFetchNews(request);
}

export async function POST(request: Request) {
  return handleFetchNews(request);
}
