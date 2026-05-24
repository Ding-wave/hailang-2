import { createClient } from "@/lib/supabase/server";
import { ensureProfileExists } from "@/lib/supabase/ensure-profile";
import ArticleAccessLink from "@/components/ArticleAccessLink";
import ManualNewsSync from "@/components/ManualNewsSync";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  content_en?: string | null;
  impact?: string | null;
  // legacy schema compatibility
  title?: string | null;
  translated_title?: string | null;
  summary?: string | null;
  deep_analysis?: string | null;
  investment_advice?: string | null;
  source?: string | null;
  image?: string | null;
  content?: string | null;
  sentiment?: string | null;
}

function mapImpactToSentiment(impact: string | null): string {
  if (impact?.includes("偏多")) return "positive";
  if (impact?.includes("偏空")) return "negative";
  return "neutral";
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
  const excerpt = canReadDeepAnalysis
    ? article.deep_analysis ?? (article.content ? article.content.slice(0, 80) + "…" : null)
    : null;

  if (featured) {
    return (
      <ArticleAccessLink
        href={`/articles/${article.id}`}
        canReadDeepAnalysis={canReadDeepAnalysis}
        className="group block w-full text-left"
      >
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
              <p className="text-[13px] text-[var(--muted)] line-clamp-2 leading-relaxed mb-3">
                {excerpt}
              </p>
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
    <ArticleAccessLink
      href={`/articles/${article.id}`}
      canReadDeepAnalysis={canReadDeepAnalysis}
      className="group block w-full text-left"
    >
      <div className="flex gap-4 bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--card-border)] hover:border-[var(--gold)] transition-colors duration-200">
        {/* Thumbnail */}
        <div className="shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden bg-[var(--card-border)]">
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-xl">
              📰
            </div>
          )}
        </div>

        {/* Content */}
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
              <p className="text-[12px] text-[var(--muted)] line-clamp-2 mt-1 leading-relaxed">
                {excerpt}
              </p>
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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/");
  }
  await ensureProfileExists({ id: user.id, email: user.email });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();
  const canReadDeepAnalysis = profile?.subscription_status === "active";

  const {
    data: rawArticles,
    error: articlesError,
  } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(21);

  // Some environments still use created_at instead of published_at.
  const { data: rawArticlesByCreatedAt, error: createdAtOrderError } =
    !rawArticles && articlesError
      ? await supabase
          .from("articles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(21)
      : { data: null, error: null };

  const articles: Article[] =
    ((
      rawArticles ??
      rawArticlesByCreatedAt
    ) as RawArticleRow[] | null)?.map((row) => ({
      id: row.id,
      title: row.title_en ?? row.title ?? "Untitled",
      translated_title: row.title_zh ?? row.translated_title ?? null,
      deep_analysis:
        row.deep_analysis_zh ??
        row.deep_analysis ??
        row.summary_zh ??
        row.summary ??
        null,
      investment_advice:
        row.investment_advice_zh ?? row.investment_advice ?? null,
      sentiment: row.impact
        ? mapImpactToSentiment(row.impact)
        : (row.sentiment ?? "neutral"),
      source: row.source_name ?? row.source ?? null,
      image: row.image_url ?? row.image ?? null,
      published_at: row.published_at ?? row.created_at ?? null,
      content: row.content_en ?? row.content ?? null,
    })) ?? [];

  const articleQueryError = articlesError ?? createdAtOrderError;

  const featured = articles?.slice(0, 3) ?? [];
  const list = articles?.slice(3) ?? [];
  const total = articles?.length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ── Hero ── */}
      <section className="max-w-2xl mx-auto px-4 pt-14 pb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-3 tracking-tight">
          海浪资讯
        </h1>
        <p className="text-base text-[var(--muted)] mb-8">
          全球新闻快人一步，智能解析助您决策
        </p>
        {user ? (
          <Link
            href="/dashboard"
            className="inline-block w-full max-w-sm py-3.5 rounded-2xl font-semibold text-white text-base transition-opacity hover:opacity-90"
            style={{ background: "var(--gold)" }}
          >
            进入个人中心
          </Link>
        ) : (
          <>
            <Link
              href="/auth/register"
              className="inline-block w-full max-w-sm py-3.5 rounded-2xl font-semibold text-white text-base transition-opacity hover:opacity-90"
              style={{ background: "var(--gold)" }}
            >
              免费开始
            </Link>
            <p className="mt-3 text-[12px] text-[var(--muted)]">
              已有账号？
              <Link href="/auth/login" className="text-[var(--gold)] ml-1 hover:underline">
                登录
              </Link>
            </p>
          </>
        )}
      </section>

      {/* ── Main content ── */}
      <div className="max-w-4xl mx-auto px-4 pb-16">

        {total > 0 ? (
          <>
            {/* Section header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--foreground)]">今日新闻</h2>
              <span className="text-sm text-[var(--muted)]">{total} 条</span>
            </div>

            {/* Featured grid — top 3 */}
            {featured.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {featured.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    featured
                    canReadDeepAnalysis={canReadDeepAnalysis}
                  />
                ))}
              </div>
            )}

            {/* ── Premium upsell banner ── */}
            <div
              className="rounded-2xl p-4 mb-5 flex items-center justify-between gap-4"
              style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
            >
              <p className="text-[13px] font-medium text-[var(--gold)]">
                升级会员，查看 AI 深度市场分析 &amp; 解锁完整原文阅读
              </p>
              <Link
                href={user ? "/pricing" : "/auth/register"}
                className="shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--gold)" }}
              >
                查看方案
              </Link>
            </div>

            {/* Article list */}
            <div className="flex flex-col gap-3">
              {list.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  canReadDeepAnalysis={canReadDeepAnalysis}
                />
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="text-center py-20 bg-[var(--card-bg)] rounded-2xl border border-dashed border-[var(--card-border)]">
            <p className="text-3xl mb-4">🌊</p>
            <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">
              暂无新闻数据
            </h3>
            <p className="text-[13px] text-[var(--muted)] mb-6">
              触发定时任务，即可自动抓取并解析最新资讯
            </p>
            <code
              className="block max-w-sm mx-auto text-[12px] px-4 py-3 rounded-xl font-mono"
              style={{ background: "var(--card-border)", color: "var(--foreground)" }}
            >
              GET /api/cron/fetch-news
              <br />
              Authorization: Bearer YOUR_CRON_SECRET
            </code>
            {articleQueryError && (
              <p className="mt-4 text-[12px] text-[#B42318]">
                读取新闻失败：{articleQueryError.message}
              </p>
            )}
            <ManualNewsSync />
          </div>
        )}
      </div>
    </div>
  );
}
