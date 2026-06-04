import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_PREVIEW_ARTICLE_COUNT = 3;

export async function getFreePreviewArticleIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data } = await supabase
    .from("articles")
    .select("id")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(FREE_PREVIEW_ARTICLE_COUNT);

  return new Set((data ?? []).map((row) => row.id));
}

export async function canReadArticleAiContent(params: {
  supabase: SupabaseClient;
  articleId: string;
  hasFullAccess: boolean;
}): Promise<boolean> {
  if (params.hasFullAccess) return true;
  const ids = await getFreePreviewArticleIds(params.supabase);
  return ids.has(params.articleId);
}
