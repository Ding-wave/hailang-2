import { createClient } from "@/lib/supabase/server";
import { downgradeExpiredSubscriptionIfNeeded } from "@/lib/subscription/status";
import ArticleAccessLink from "@/components/ArticleAccessLink";
import ManualNewsSync from "@/components/ManualNewsSync";
import NewsRefreshButton from "@/components/NewsRefreshButton";
import Link from "next/link";

interface Article {
  id: string;
  title: string;
  translated_title: string | null;
  deep_analysis: string | null;
  investment_advice: string | null;
  sentiment: string | null;
  source: string | null;
  image: string | null;
  published_at: string | null;
  content: string | null;
}

interface RawArticleRow {
  id: string;
  title_en?: string | null;
  title_zh?: string | null;
  summary_zh?: string | null;
  deep_analysis_zh?: string | null;
  investment_advice_zh?: string | null;
  source_name?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  impact?: string | null;
  title?: string | null;
  translated_title?: string | null;
  summary?: string | null;
  deep_analysis?: string | null;
  investment_advice?: string | null;
  source?: string | null;
  image?: string | null;
  sentiment?: string | null;
}

const PAGE_SIZE = 15;
// Exclude large text (content_en, content_zh, etc.) but keep all card-render fields.
const ARTICLE_LIST_COLUMN_SETS = [
  // Modern schema (source_url / title_en / *_zh columns)
  "id,title_en,title_zh,summary_zh,deep_analysis_zh,investment_advice_zh,impact,source_name,image_url,published_at,created_at,ai_status",
  // Hybrid: modern + legacy aliases when both exist
  "id,title_en,title,title_zh,translated_title,summary_zh,summary,deep_analysis_zh,investment_advice_zh,impact,sentiment,source_name,source,image_url,image,published_at,created_at,ai_status",
  // Legacy schema
  "id,title,translated_title,summary,deep_analysis_zh,investment_advice_zh,sentiment,source,image,published_at,created_at",
] as const;

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("column") && normalized.includes("does not exist");
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function fetchArticlesWithFallback(
  supabase: SupabaseServerClient,
  options: { rangeStart: number; rangeEnd: number } | { limit: number }
) {
  let lastError: { message: string } | null = null;

  for (const columns of ARTICLE_LIST_COLUMN_SETS) {
    let query = supabase
      .from("articles")
      .select(columns as string)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if ("limit" in options) {
      query = query.limit(options.limit);
    } else {
      query = query.range(options.rangeStart, options.rangeEnd);
    }

    const { data, error } = await query;
    if (!error) {
      return { data: data as unknown as RawArticleRow[] | null, error: null };
    }

    lastError = error;
    if (!isMissingColumnError(error.message)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

function mapImpactToSentiment(impact: string | null): string {
  if (impact?.includes("偏多")) return "positive";
  if (impact?.includes("偏空")) return "negative";
  return "neutral";
}

function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function pageHref(page: number): string {
  if (page <= 1) return "/";
  return `/?page=${page}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  return "刚刚";
}

function mapRow(row: RawArticleRow): Article {
  return {
    id: row.id,
    title: row.title_en ?? row.title ?? "Untitled",
    translated_title: row.title_zh ?? row.translated_title ?? null,
    deep_analysis:
      row.deep_analysis_zh ?? row.deep_analysis ?? row.summary_zh ?? row.summary ?? null,
    investment_advice: row.investment_advice_zh ?? row.investment_advice ?? null,
    sentiment: row.impact ? mapImpactToSentiment(row.impact) : (row.sentiment ?? "neutral"),
    source: row.source_name ?? row.source ?? null,
    image: row.image_url ?? row.image ?? null,
    published_at: row.published_at ?? row.created_at ?? null,
    content: null,
  };
}

function SentimentDot({ sentiment }: { sentiment: string | null }) {
  const colors: Record<string, string> = {
    positive: "bg-emerald-500",
    negative: "bg-red-500",
    neutral: "bg-stone-400",
  };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${colors[sentiment ?? "neutral"] ?? colors.neutral}`}
    />
  );
}

function CategoryTag({ text }: { text: string }) {
  return (
    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--gold-light)] text-[var(--gold)] border border-[var(--gold-light)]">
      {text}
    </span>
  );
}

function ArticleCard({
  article,
  featured = false,
  canReadDeepAnalysis,
}: {
  article: Article;
  featured?: boolean;
  canReadDeepAnalysis: boolean;
}) {
  const ago = timeAgo(article.published_at);
  const displayTitle = article.translated_title || article.title;
  const excerpt = canReadDeepAnalysis ? article.deep_analysis : null;

  if (featured) {
    return (
      <ArticleAccessLink href={`/articles/${article.id}`} className="group block w-full text-left">
        <div className="bg-[var(--card-bg)] rounded-2xl overflow-hidden border border-[var(--card-border)] hover:border-[var(--gold)] transition-colors duration-200">
          {article.image && (
            <div className="w-full h-48 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image}
                alt={displayTitle}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              {article.source && (
                <span className="text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase">
                  {article.source}
                </span>
              )}
              <CategoryTag text="科技" />
            </div>
            <h3 className="text-[15px] font-bold text-[var(--foreground)] leading-snug line-clamp-2 mb-1">
              {displayTitle}
            </h3>
            {excerpt && (
              <p className="text-[13px] text-[var(--muted)] line-clamp-2 leading-relaxed mb-3">{excerpt}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--muted)]">{ago}</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--card-border)] text-[var(--muted)]">
                {canReadDeepAnalysis ? "AI 解析" : "订阅可查看深度解析"}
              </span>
            </div>
          </div>
        </div>
      </ArticleAccessLink>
    );
  }

  return (
    <ArticleAccessLink href={`/articles/${article.id}`} className="group block w-full text-left">
      <div className="flex gap-4 bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--card-border)] hover:border-[var(--gold)] transition-colors duration-200">
        <div className="shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden bg-[var(--card-border)]">
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-xl">📰</div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {article.source && (
                <span className="text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase truncate">
                  {article.source}
                </span>
              )}
              <CategoryTag text="科技" />
            </div>
            <h3 className="text-[14px] font-bold text-[var(--foreground)] leading-snug line-clamp-2">
              {displayTitle}
            </h3>
            {excerpt && (
              <p className="text-[12px] text-[var(--muted)] line-clamp-2 mt-1 leading-relaxed">{excerpt}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <SentimentDot sentiment={article.sentiment} />
              <span className="text-[12px] text-[var(--muted)]">{ago}</span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--card-border)] text-[var(--muted)]">
              {canReadDeepAnalysis ? "AI 解析" : "订阅可查看深度解析"}
            </span>
          </div>
        </div>
      </div>
    </ArticleAccessLink>
  );
}

export default async function HomeArticleFeed({
  pageParam,
}: {
  pageParam?: string;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status,is_subscribed,subscription_end,subscription_end_at,cancel_at_period_end")
    .eq("id", userId)
    .single();

  const downgraded = await downgradeExpiredSubscriptionIfNeeded({ supabase, userId, profile });
  const canReadDeepAnalysis = downgraded
    ? false
    : profile?.is_subscribed === true || profile?.subscription_status === "active";

  const requestedPage = canReadDeepAnalysis ? parsePageParam(pageParam) : 1;
  const effectivePageSize = canReadDeepAnalysis ? PAGE_SIZE : 3;

  let totalCount = 0;
  let totalPages = 1;
  let currentPage = 1;
  let rawArticles: RawArticleRow[] | null = null;
  let articleQueryError: { message: string } | null = null;

  if (canReadDeepAnalysis) {
    const countResult = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true });

    totalCount = countResult.count ?? 0;
    totalPages = totalCount > 0 ? Math.ceil(totalCount / effectivePageSize) : 1;
    currentPage = Math.min(requestedPage, totalPages);

    const rangeStart = (currentPage - 1) * effectivePageSize;
    const rangeEnd = rangeStart + effectivePageSize - 1;

    const articlesResult = await fetchArticlesWithFallback(supabase, { rangeStart, rangeEnd });

    rawArticles = articlesResult.data;
    articleQueryError = articlesResult.error ?? countResult.error;
  } else {
    const articlesResult = await fetchArticlesWithFallback(supabase, { limit: 3 });
    rawArticles = articlesResult.data;
    articleQueryError = articlesResult.error;
    totalCount = rawArticles?.length ?? 0;
  }

  const articles = rawArticles?.map(mapRow) ?? [];
  const visibleArticles = canReadDeepAnalysis ? articles : articles.slice(0, 3);
  const featured = visibleArticles.slice(0, 3);
  const list = visibleArticles.slice(3);
  const total = canReadDeepAnalysis ? totalCount : Math.min(totalCount, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      {!canReadDeepAnalysis && (
        <div className="text-center mb-8">
          <Link
            href="/dashboard"
            className="inline-block w-full max-w-sm py-3.5 rounded-2xl font-semibold text-white text-base transition-opacity hover:opacity-90"
            style={{ background: "var(--gold)" }}
          >
            进入个人中心
          </Link>
        </div>
      )}

      {total > 0 ? (
        <>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[var(--foreground)]">今日新闻</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">
                {canReadDeepAnalysis ? `${total} 条` : `仅展示 ${total} 条`}
              </span>
              <NewsRefreshButton />
            </div>
          </div>

          {articleQueryError && visibleArticles.length === 0 && (
            <p className="mb-4 text-[12px] text-[#B42318]">读取新闻失败：{articleQueryError.message}</p>
          )}

          {featured.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {featured.map((a) => (
                <ArticleCard key={a.id} article={a} featured canReadDeepAnalysis={canReadDeepAnalysis} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {list.map((a) => (
              <ArticleCard key={a.id} article={a} canReadDeepAnalysis={canReadDeepAnalysis} />
            ))}
          </div>

          {!canReadDeepAnalysis && (
            <div
              className="rounded-2xl p-4 mt-5 flex items-center justify-between gap-4"
              style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--gold)" }}>
                升级订阅会员，解锁全部深度 AI 市场分析
              </p>
              <Link
                href="/pricing"
                className="shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--gold)" }}
              >
                前往订阅中心
              </Link>
            </div>
          )}

          {canReadDeepAnalysis && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <Link
                href={pageHref(currentPage - 1)}
                aria-disabled={currentPage <= 1}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-opacity hover:opacity-85 aria-disabled:opacity-40 aria-disabled:pointer-events-none"
                style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
              >
                上一页
              </Link>
              <span className="text-[12px] text-[var(--muted)]">
                第 {currentPage} / {totalPages} 页
              </span>
              <Link
                href={pageHref(currentPage + 1)}
                aria-disabled={currentPage >= totalPages}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-opacity hover:opacity-85 aria-disabled:opacity-40 aria-disabled:pointer-events-none"
                style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
              >
                下一页
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-[var(--card-bg)] rounded-2xl border border-dashed border-[var(--card-border)]">
          <p className="text-3xl mb-4">🌊</p>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">暂无新闻数据</h3>
          <p className="text-[13px] text-[var(--muted)] mb-6">触发定时任务，即可自动抓取并解析最新资讯</p>
          <code
            className="block max-w-sm mx-auto text-[12px] px-4 py-3 rounded-xl font-mono"
            style={{ background: "var(--card-border)", color: "var(--foreground)" }}
          >
            GET /api/cron/fetch-news
            <br />
            Authorization: Bearer YOUR_CRON_SECRET
          </code>
          {articleQueryError && (
            <p className="mt-4 text-[12px] text-[#B42318]">读取新闻失败：{articleQueryError.message}</p>
          )}
          <ManualNewsSync />
        </div>
      )}
    </div>
  );
}
