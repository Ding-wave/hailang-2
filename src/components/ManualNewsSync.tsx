"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function ManualNewsSync() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSync = async () => {
    const token = secret.trim();
    if (!token) {
      setIsError(true);
      setMessage("请先输入 CRON_SECRET。");
      return;
    }

    setLoading(true);
    setIsError(false);
    setMessage("正在同步新闻，这可能需要 1-3 分钟，请不要重复点击。");

    try {
      const response = await fetch("/api/cron/fetch-news", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? `接口返回 ${response.status}`);
      }

      const results = data?.results;
      setMessage(
        `同步完成：抓取 ${results?.fetched ?? 0} 条，写入 ${results?.upserted ?? 0} 条，错误 ${results?.errors?.length ?? 0} 条。`
      );
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(`同步失败：${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-6 text-left">
      <label
        className="block text-[12px] font-semibold mb-2"
        style={{ color: "var(--foreground)" }}
      >
        手动同步新闻测试通道
      </label>
      <input
        type="password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder="输入 CRON_SECRET"
        className="w-full px-4 py-2.5 rounded-xl text-[13px] outline-none"
        style={{
          background: "var(--background)",
          border: "1px solid var(--card-border)",
          color: "var(--foreground)",
        }}
      />
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="w-full mt-3 py-2.5 rounded-xl font-semibold text-[13px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--gold)" }}
      >
        {loading ? "同步中..." : "手动同步新闻"}
      </button>
      {message && (
        <p
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: isError ? "#B42318" : "var(--muted)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
