"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface ArticleAccessLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export default function ArticleAccessLink({
  href,
  className,
  children,
}: ArticleAccessLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
