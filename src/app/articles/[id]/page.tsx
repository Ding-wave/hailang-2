import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { ReactNode } from "react";

const sentimentInfo: Record<string, { label: string; color: string; dot: string }> = {
  positive: { label: "正面情绪", color: "#10B981", dot: "#10B981" },
  negative: { label: "负面情绪", color: "#EF4444", dot: "#EF4444" },
  neutral:  { label: "中立情绪", color: "#A67C00", dot: "#A67C00" },
};

type RichBlock =
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string; index: number }
  | { type: "paragraph"; text: string };

function mapImpactToSentiment(impact: string | null): string {
  if (impact?.includes("偏多")) return "positive";
  if (impact?.includes("偏空")) return "negative";
  return "neutral";
}

function normalizeRichText(text: string): string {
  const withHeadings = text
    .replace(/\r\n?/g, "\n")
    .replace(/(📊\s*【[^】]+】|📈\s*【[^】]+】|⚠️\s*【[^】]+】|💡)/g, "\n$1\n")
    .replace(/•\s*/g, "\n• ");

  return withHeadings
    .replace(/(^|[^\n])(\d+\.\s+)/g, (_match, before, num) => `${before}\n${num}`)
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseRichBlocks(text: string): RichBlock[] {
  const normalized = normalizeRichText(text);
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    if (/^(📊|📈|⚠️|💡)/.test(line)) {
      return { type: "heading", text: line };
    }
    if (line.startsWith("•")) {
      return { type: "bullet", text: line.replace(/^•\s*/, "").trim() };
    }
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    if (numbered) {
      return {
        type: "numbered",
        index: Number(numbered[1]),
        text: numbered[2].trim(),
      };
    }
    return { type: "paragraph", text: line };
  });
}

function renderRichBlocks(text: string) {
  const blocks = parseRichBlocks(text);
  if (!blocks.length) return null;

  const rendered: ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === "bullet") {
      const items: string[] = [];
      while (i < blocks.length && blocks[i].type === "bullet") {
        items.push((blocks[i] as { type: "bullet"; text: string }).text);
        i++;
      }
      rendered.push(
        <ul key={`bullets-${i}`} className="list-disc pl-5 space-y-2 text-[14px] leading-relaxed">
          {items.map((item, idx) => (
            <li key={`bullet-${idx}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (block.type === "numbered") {
      const items: { index: number; text: string }[] = [];
      while (i < blocks.length && blocks[i].type === "numbered") {
        items.push(blocks[i] as { type: "numbered"; text: string; index: number });
        i++;
      }
      rendered.push(
        <ol key={`numbered-${i}`} className="space-y-3 text-[14px] leading-relaxed">
          {items.map((item, idx) => (
            <li key={`num-${idx}`} className="flex gap-2">
              <span className="font-semibold text-[var(--gold)]">{item.index}.</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (block.type === "heading") {
      rendered.push(
        <p key={`heading-${i}`} className="text-[13px] font-bold mt-1" style={{ color: "var(--gold)" }}>
          {block.text}
        </p>
      );
      i++;
      continue;
    }

    rendered.push(
      <p key={`para-${i}`} className="text-[14px] leading-relaxed">
        {block.text}
      </p>
    );
    i++;
  }

  return <div className="space-y-3">{rendered}</div>;
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) notFound();

  const sentiment = article.impact
    ? mapImpactToSentiment(article.impact)
    : (article.sentiment ?? "neutral");
  const si = sentimentInfo[sentiment] ?? sentimentInfo.neutral;
  const summaryText = article.summary_zh || article.summary || article.deep_analysis_zh || article.deep_analysis;
  const deepAnalysisText = article.deep_analysis_zh || article.deep_analysis;
  const investmentAdviceText = article.investment_advice_zh || article.investment_advice;
  const summaryParts: string[] = (summaryText ?? "")
    .split("➜")
    .map((part: string) => part.trim())
    .filter((part: string) => Boolean(part));

  const publishedAt = article.published_at ?? article.created_at ?? null;
  const date = publishedAt
    ? new Date(publishedAt).toLocaleDateString("zh-CN", {
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
          {article.title_zh || article.translated_title || article.title_en || article.title}
        </h1>

        {(article.title_zh || article.translated_title) &&
          article.title_en &&
          article.title_en !== (article.title_zh || article.translated_title) && (
          <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
            {article.title_en}
          </p>
          )}

        {/* Source + time row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(article.source_name || article.source) && (
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              {article.source_name || article.source}
            </span>
          )}
          {date && (
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>{date}</span>
          )}
          {sentiment && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--card-bg)", color: si.color, border: `1px solid ${si.dot}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: si.dot }} />
              {si.label}
            </span>
          )}
        </div>

        {/* Hero image */}
        {(article.image_url || article.image) && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1px solid var(--card-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image_url || article.image}
              alt={article.title_en || article.title || "Article image"}
              className="w-full h-56 sm:h-72 object-cover"
            />
          </div>
        )}

        {/* Chinese summary */}
        {summaryText && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
              新闻中文总结
            </p>
            <div className="space-y-2 text-[14px] leading-relaxed" style={{ color: "var(--foreground)" }}>
              {summaryParts.length > 1 ? (
                summaryParts.map((part: string, idx: number) => (
                  <p key={`summary-${idx}`}>
                    {idx === 0 ? part : `➜ ${part}`}
                  </p>
                ))
              ) : (
                <p>{summaryText}</p>
              )}
            </div>
          </div>
        )}

        {/* AI deep analysis */}
        {deepAnalysisText && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>
              AI 深度解析
            </p>
            <div style={{ color: "var(--foreground)" }}>
              {renderRichBlocks(deepAnalysisText)}
            </div>
          </div>
        )}

        {/* AI investment advice */}
        {investmentAdviceText && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--gold)" }}>
              AI 投资建议
            </p>
            <div style={{ color: "var(--foreground)" }}>
              {renderRichBlocks(investmentAdviceText)}
            </div>
          </div>
        )}

        {/* Source link */}
        {(article.source_url || article.url) && (
          <div className="pt-5" style={{ borderTop: "1px solid var(--card-border)" }}>
            <a
              href={article.source_url || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold hover:underline transition-opacity hover:opacity-80"
              style={{ color: "var(--gold)" }}
            >
              前往 {article.source_name || article.source || "原始来源"} 查看原文 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
