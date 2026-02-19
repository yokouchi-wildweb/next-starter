// src/components/Common/Pagination.tsx
"use client";

import { useState, type KeyboardEvent } from "react";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { LinkButton } from "@/components/Form/Button/LinkButton";

export type PaginationProps = {
  page: number;
  perPage: number;
  total: number;
  makeHref: (page: number) => string;
  /** ページ番号を直接入力してジャンプするUIを表示する */
  usePageJump?: boolean;
};

export default function Pagination({ page, perPage, total, makeHref, usePageJump }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, total);
  const pages: number[] = [];
  let startPage = Math.max(1, currentPage - 2);
  let endPage = startPage + 4;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - 4);
  }
  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }
  const showFirst = currentPage > 1;
  const showPrev = currentPage > 1;
  const showNext = currentPage < totalPages;
  const showLast = currentPage < totalPages;
  const firstHref = makeHref(1);
  const prevHref = makeHref(Math.max(1, currentPage - 1));
  const nextHref = makeHref(Math.min(totalPages, currentPage + 1));
  const lastHref = makeHref(totalPages);
  return (
    <div className="flex items-center gap-1 text-sm whitespace-nowrap">
      <span className="mr-2 whitespace-nowrap">
        {start} - {end} （{total}件中）
      </span>
      {showFirst && (
        <LinkButton href={firstHref} size="sm" variant="ghost" className="px-1 min-w-8" aria-label="First page">
          <ChevronsLeft className="size-4" />
        </LinkButton>
      )}
      {showPrev && (
        <LinkButton href={prevHref} size="sm" variant="ghost" className="px-1 min-w-8" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </LinkButton>
      )}
      {pages.map((p) =>
        p === currentPage ? (
          <span key={p} className="px-2 font-bold">
            {p}
          </span>
        ) : (
          <LinkButton key={p} href={makeHref(p)} size="sm" variant="outline" className="px-1 min-w-8">
            {p}
          </LinkButton>
        ),
      )}
      {showNext && (
        <LinkButton href={nextHref} size="sm" variant="ghost" className="px-1 min-w-8" aria-label="Next page">
          <ChevronRight className="size-4" />
        </LinkButton>
      )}
      {showLast && (
        <LinkButton href={lastHref} size="sm" variant="ghost" className="px-1 min-w-8" aria-label="Last page">
          <ChevronsRight className="size-4" />
        </LinkButton>
      )}
      {usePageJump && <PageJumpInput currentPage={currentPage} totalPages={totalPages} makeHref={makeHref} />}
    </div>
  );
}

function PageJumpInput({
  currentPage,
  totalPages,
  makeHref,
}: {
  currentPage: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentPage));

  const handleJump = () => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > totalPages || parsed === currentPage) {
      setValue(String(currentPage));
      return;
    }
    router.push(makeHref(parsed));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJump();
    }
  };

  return (
    <span className="ml-2 flex items-center gap-1 text-muted-foreground">
      <input
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleJump}
        className="h-7 w-12 rounded border border-input bg-background px-1.5 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="ページ番号を入力"
      />
      <span>/ {totalPages}</span>
    </span>
  );
}
