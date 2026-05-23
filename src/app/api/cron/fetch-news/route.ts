import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GnewsArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string | null };
}

interface GeminiAnalysisResult {
  translated_title: string;
  translated_content: string;
  summary: string;
  sentiment: "positive" | "negative" | "neutral";
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function extractJsonFromText(text: string): string {
  const withoutFence = text.replace(/```json|```/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return valid JSON");
  }
  return withoutFence.slice(start, end + 1);
}

function normalizeSentiment(value: string): "positive" | "negative" | "neutral" {
  if (value === "positive" || value === "negative" || value === "neutral") {
    return value;
  }
  return "neutral";
}

function isCronRequestAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return true;
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

async function processWithGemini(
  genai: GoogleGenerativeAI,
  article: GnewsArticle
): Promise<GeminiAnalysisResult> {
  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const originalText = article.content || article.description || article.title;

  const prompt = `你是一位资深金融市场分析师。请处理下面新闻，并严格返回 JSON。

新闻标题: ${article.title}
新闻正文: ${originalText}

必须满足以下要求：
1) 把标题和正文翻译为简体中文。
2) 给出“深度市场解析 summary”：
   - 3~5句中文
   - 明确说明“对金融市场可能的影响”
   - 尽量覆盖股票、债券、美元/汇率、大宗商品中的至少2项（若信息不足要说明）
   - 给出一个简短结论（偏多/偏空/中性）
3) sentiment 只能是 "positive" | "negative" | "neutral"。

只返回合法 JSON，字段如下：
{
  "translated_title": "中文标题",
  "translated_content": "中文正文（不超过500字）",
  "summary": "中文深度市场解析（3~5句）",
  "sentiment": "positive" | "negative" | "neutral"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const parsed = JSON.parse(extractJsonFromText(text)) as GeminiAnalysisResult;

  return {
    translated_title: parsed.translated_title?.trim() || article.title,
    translated_content: parsed.translated_content?.trim() || originalText,
    summary: parsed.summary?.trim() || "暂无深度解析",
    sentiment: normalizeSentiment(parsed.sentiment),
  };
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const gnewsApiKey = requireEnv("GNEWS_API_KEY");
  const geminiApiKey = requireEnv("GEMINI_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const genai = new GoogleGenerativeAI(geminiApiKey);

  const results = {
    fetched: 0,
    skipped: 0,
    processed: 0,
    upserted: 0,
    errors: [] as string[],
  };

  try {
    const gnewsUrl = new URL("https://gnews.io/api/v4/top-headlines");
    gnewsUrl.searchParams.set("category", "business");
    gnewsUrl.searchParams.set("lang", "en");
    gnewsUrl.searchParams.set("country", "us");
    gnewsUrl.searchParams.set("max", "10");
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
    const seenUrls = new Set<string>();
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

      // 13-second delay between Gemini calls to respect 5 RPM rate limit
      if (i > 0) {
        await delay(13000);
      }

      try {
        const geminiData = await processWithGemini(genai, article);
        results.processed++;

        const { error } = await supabase.from("articles").upsert(
          {
            title: article.title?.trim() || "Untitled",
            original_title: article.title?.trim() || "Untitled",
            content: article.content || article.description,
            translated_title: geminiData.translated_title,
            translated_content: geminiData.translated_content,
            summary: geminiData.summary,
            sentiment: geminiData.sentiment,
            source: article.source?.name || "Unknown",
            url: article.url,
            image: article.image,
            published_at: article.publishedAt,
          },
          { onConflict: "url" }
        );

        if (error) {
          results.errors.push(
            `Upsert error for "${article.title}": ${error.message}`
          );
        } else {
          results.upserted++;
        }
      } catch (err) {
        results.errors.push(
          `Gemini error for "${article.title}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return Response.json({ success: true, results });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
