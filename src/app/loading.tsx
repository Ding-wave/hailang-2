export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--background)] animate-pulse">
      <section className="max-w-2xl mx-auto px-4 pt-14 pb-10 text-center">
        <div className="h-9 w-40 bg-[var(--card-border)] rounded-lg mx-auto mb-3" />
        <div className="h-5 w-64 bg-[var(--card-border)] rounded mx-auto" />
      </section>
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="h-6 w-24 bg-[var(--card-border)] rounded mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)]" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
