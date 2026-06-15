"use client";

import { useMemo, useState } from "react";
import {
  getProxiedImageUrl,
  normalizeArticleImageUrl,
} from "@/lib/articles/image-url";

interface ArticleImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export default function ArticleImage({
  src,
  alt,
  className,
  placeholderClassName,
}: ArticleImageProps) {
  const normalized = useMemo(() => normalizeArticleImageUrl(src), [src]);
  const [useProxy, setUseProxy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!normalized || failed) {
    return (
      <div
        className={
          placeholderClassName ??
          "w-full h-full flex items-center justify-center text-[var(--muted)] text-xl bg-[var(--card-border)]"
        }
      >
        📰
      </div>
    );
  }

  const imageSrc = useProxy ? getProxiedImageUrl(normalized) : normalized;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!useProxy) {
          setUseProxy(true);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
