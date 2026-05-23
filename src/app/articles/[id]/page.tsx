import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const sentimentInfo: Record<string, { label: string; color: string; dot: string }> = {
  positive: { label: "正面情绪", color: "#10B981", dot: "#10B981" },
  negative: { label: "负面情绪", color: "#EF4444", dot: "#EF4444" },
  neutral:  { label: "中立情绪", color: "#A67C00", dot: "#A67C00" },
};

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) notFound();

  const si = sentimentInfo[article.sentiment ?? "neutral"] ?? sentimentInfo.neutral;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("zh-CN", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-7 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          ← 返回资讯列表
        </Link>

        {/* Premium badge */}
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5 text-white"
          style={{ background: "var(--gold)" }}
        >
          会员专属
        </span>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-3" style={{ color: "var(--foreground)" }}>
          {article.translated_title || article.title}
        </h1>

        {article.translated_title && article.title !== article.translated_title && (
          <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
            {article.title}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {article.sentiment && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--card-bg)", color: si.color, border: `1px solid ${si.dot}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: si.dot }} />
              {si.label}
            </span>
          )}
          {article.source && (
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              {article.source}
            </span>
          )}
          {date && (
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>{date}</span>
          )}
        </div>

        {/* Hero image */}
        {article.image && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1px solid var(--card-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.image} alt={article.title} className="w-full h-56 sm:h-72 object-cover" />
          </div>
        )}

        {/* AI Summary */}
        {article.summary && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>
              AI 智能摘要
            </p>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
              {article.summary}
            </p>
          </div>
        )}

        {/* Chinese translation */}
        {article.translated_content && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
              中文译文
            </p>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
              {article.translated_content}
            </p>
          </div>
        )}

        {/* Full content */}
        {article.content && (
          <div className="mb-8">
            <p className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
              原文正文
            </p>
            <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: "var(--foreground)" }}>
              {article.content}
            </p>
          </div>
        )}

        {/* Source link */}
        {article.url && (
          <div className="pt-5" style={{ borderTop: "1px solid var(--card-border)" }}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold hover:underline transition-opacity hover:opacity-80"
              style={{ color: "var(--gold)" }}
            >
              前往 {article.source ?? "原始来源"} 查看原文 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
