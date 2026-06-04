import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const maxFetchLimit = 10;
const defaultFetchLimit = Number(process.env.NEWS_FETCH_LIMIT ?? "3");
const gnewsTimeoutMs = Number(process.env.GNEWS_TIMEOUT_MS ?? "8000");
const supabaseTimeoutMs = Number(process.env.SUPABASE_TIMEOUT_MS ?? "8000");

interface GnewsArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string | null };
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

function shouldRetryWithLegacySchema(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("on_conflict")
  );
}

function withQueueFields<T extends Record<string, unknown>>(row: T, includeQueueFields: boolean) {
  if (!includeQueueFields) return row;
  return {
    ...row,
    ai_status: "pending",
    ai_error: null,
  };
}

function isCronRequestAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const normalizeCandidate = (raw: string | null | undefined) => {
    if (!raw) return "";
    let candidate = raw.trim();
    candidate = candidate.replace(/^Bearer\s+/i, "").trim();
    if (
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
      candidate = candidate.slice(1, -1).trim();
    }
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded) candidate = decoded;
    } catch {
      // keep original if decode fails
    }
    return candidate;
  };

  const xCronSecret = normalizeCandidate(request.headers.get("x-cron-secret"));
  if (xCronSecret === expectedSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    const url = new URL(request.url);
    const querySecret = (
      url.searchParams.get("cron_secret") ??
      url.searchParams.get("secret") ??
      ""
    ).trim();
    return normalizeCandidate(querySecret) === expectedSecret;
  }

  const authSecret = normalizeCandidate(authHeader);
  if (authSecret === expectedSecret) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = (
    url.searchParams.get("cron_secret") ??
    url.searchParams.get("secret") ??
    ""
  ).trim();
  return normalizeCandidate(querySecret) === expectedSecret;
}

function clampFetchLimit(value: string | null): number {
  const parsed = Number(value ?? defaultFetchLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(Math.max(defaultFetchLimit, 1), maxFetchLimit);
  }
  return Math.min(Math.floor(parsed), maxFetchLimit);
}

import { chinaIso } from "@/lib/datetime";

function toIsoDateOrNow(value: string | null | undefined): string {
  if (!value) return chinaIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return chinaIso();
  return chinaIso(parsed);
}

function mergeTimeoutSignal(existingSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!existingSignal) return timeoutSignal;
  return AbortSignal.any([existingSignal, timeoutSignal]);
}

async function handleFetchNews(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const fetchLimit = clampFetchLimit(url.searchParams.get("fetch_limit"));
    const gnewsApiKey = requireEnv("GNEWS_API_KEY");

    const gnewsUrl = new URL("https://gnews.io/api/v4/top-headlines");
    gnewsUrl.searchParams.set("category", "business");
    gnewsUrl.searchParams.set("lang", "en");
    gnewsUrl.searchParams.set("country", "us");
    gnewsUrl.searchParams.set("max", String(fetchLimit));
    gnewsUrl.searchParams.set("apikey", gnewsApiKey);

    const gnewsRes = await fetch(gnewsUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(gnewsTimeoutMs),
    });
    if (!gnewsRes.ok) {
      return NextResponse.json(
        { error: `Gnews fetch failed: ${gnewsRes.status}` },
        { status: 500 }
      );
    }

    const gnewsData = (await gnewsRes.json()) as { articles?: GnewsArticle[] };
    const rawArticles = gnewsData.articles ?? [];
    const uniqueArticles = rawArticles.filter((article) => Boolean(article?.url));

    if (uniqueArticles.length === 0) {
      return NextResponse.json({ success: true, message: "Fetch completed" });
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseWriteKey(), {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: mergeTimeoutSignal(init?.signal, supabaseTimeoutMs),
          }),
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const nextSchemaPayload = uniqueArticles.map((article) => ({
      source_url: article.url,
      title_en: article.title?.trim() || "Untitled",
      content_en: (article.content || article.description || article.title || "").trim(),
      source_name: article.source?.name || "Unknown",
      image_url: article.image,
      published_at: toIsoDateOrNow(article.publishedAt),
    }));

    const legacyPayload = uniqueArticles.map((article) => ({
      url: article.url,
      title: article.title?.trim() || "Untitled",
      content: (article.content || article.description || article.title || "").trim(),
      source: article.source?.name || "Unknown",
      image: article.image,
      published_at: toIsoDateOrNow(article.publishedAt),
    }));

    const attempts: Array<{
      onConflict: string;
      payload: Record<string, unknown>[];
    }> = [
      {
        onConflict: "source_url",
        payload: nextSchemaPayload.map((row) => withQueueFields(row, true)),
      },
      {
        onConflict: "source_url",
        payload: nextSchemaPayload.map((row) => withQueueFields(row, false)),
      },
      {
        onConflict: "url",
        payload: legacyPayload.map((row) => withQueueFields(row, true)),
      },
      {
        onConflict: "url",
        payload: legacyPayload.map((row) => withQueueFields(row, false)),
      },
    ];

    let lastError: string | null = null;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const result = await supabase.from("articles").upsert(attempt.payload, {
        onConflict: attempt.onConflict,
        ignoreDuplicates: true,
      });

      if (!result.error) {
        lastError = null;
        break;
      }

      lastError = result.error.message;
      if (!shouldRetryWithLegacySchema(result.error.message)) {
        break;
      }
    }

    if (lastError) {
      return NextResponse.json({ error: lastError }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Fetch completed" });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        {
          success: false,
          message: "fetch-news timed out while calling upstream service",
          error: error.message,
        },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error) },
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
