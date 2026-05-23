"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface ArticleAccessLinkProps {
  href: string;
  canReadDeepAnalysis: boolean;
  className?: string;
  children: ReactNode;
}

export default function ArticleAccessLink({
  href,
  canReadDeepAnalysis,
  className,
  children,
}: ArticleAccessLinkProps) {
  if (canReadDeepAnalysis) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.alert("请订阅后查看深度解析");
      }}
    >
      {children}
    </button>
  );
}
