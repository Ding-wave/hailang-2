import { Suspense } from "react";
import HomeArticleFeed from "@/components/HomeArticleFeed";

function ArticleFeedSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 animate-pulse">
      <div className="h-6 w-24 bg-[var(--card-border)] rounded mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)]" />
        ))}
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <section className="max-w-2xl mx-auto px-4 pt-14 pb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-3 tracking-tight">
          海浪资讯
        </h1>
        <p className="text-base text-[var(--muted)]">全球新闻快人一步，智能解析助您决策</p>
      </section>

      <Suspense fallback={<ArticleFeedSkeleton />}>
        <HomeArticleFeed pageParam={params.page} />
      </Suspense>
    </div>
  );
}
