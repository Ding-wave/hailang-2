"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewsRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    router.refresh();
    setTimeout(() => {
      setLoading(false);
    }, 600);
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={loading}
      className="text-[12px] font-semibold px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-85 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        color: "var(--gold)",
        borderColor: "var(--gold)",
        background: "var(--gold-light)",
      }}
    >
      {loading ? "刷新中..." : "刷新"}
    </button>
  );
}
