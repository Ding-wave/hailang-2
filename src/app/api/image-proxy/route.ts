import {
  isAllowedExternalImageUrl,
  normalizeArticleImageUrl,
} from "@/lib/articles/image-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const normalized = normalizeArticleImageUrl(rawUrl);

  if (!normalized || !isAllowedExternalImageUrl(normalized)) {
    return new Response("Invalid image URL", { status: 400 });
  }

  try {
    const upstream = await fetch(normalized, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return new Response("Image not found", { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("Unsupported content type", { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Failed to fetch image", { status: 502 });
  }
}
