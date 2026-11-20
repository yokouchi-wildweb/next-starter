// src/components/Common/Pagination.tsx
"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort";

import { Button } from "@/components/Button/Button";
import { LinkButton } from "@/components/Button/LinkButton";

type PaginationBaseProps = {
  page: number;
  perPage: number;
  total: number;
  /** ページ番号を直接入力してジャンプするUIを表示する */
  usePageJump?: boolean;
  /**
   * 詰めた形: 「前 / p / N / 次」だけを出す(範囲の文・最初 / 最後・番号を出さない)。端の前 / 次は押せない形で残す
   * @default false
   */
  compact?: boolean;
};

/** リンクで送る(URL にページを持つ一覧) */
type PaginationHrefProps = {
  makeHref: (page: number) => string;
  onPageChange?: never;
};

/** ボタンで送る(ページを状態で持つ一覧)。押すとそのページ番号で呼ぶ */
type PaginationCallbackProps = {
  onPageChange: (page: number) => void;
  makeHref?: never;
};

/** 送り方は makeHref(リンク)か onPageChange(ボタン)のどちらか一方 */
export type PaginationProps = PaginationBaseProps & (PaginationHrefProps | PaginationCallbackProps);

type PageControlProps = {
  page: number;
  makeHref?: (page: number) => string;
  onPageChange?: (page: number) => void;
  variant: "ghost" | "outline";
  disabled?: boolean;
  "aria-label"?: string;
  children: ReactNode;
};

/** 送りの 1 つ: makeHref ならリンク、onPageChange(または押せない)ならボタン。見た目は同じ */
function PageControl({ page, makeHref, onPageChange, variant, disabled, "aria-label": ariaLabel, children }: PageControlProps) {
  if (makeHref && !disabled) {
    return (
      <LinkButton href={makeHref(page)} size="sm" variant={variant} className="px-1 min-w-8" aria-label={ariaLabel}>
        {children}
      </LinkButton>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className="px-1 min-w-8"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onPageChange?.(page)}
    >
      {children}
    </Button>
  );
}

/**
 * ページ送り。送り方は 2 通り(型でどちらか一方):
 * - `makeHref`: リンクで送る(URL にページを持つ一覧。管理一覧の Header など)
 * - `onPageChange`: ボタンで送る(ページを状態で持つ一覧)。押すとそのページ番号で呼ぶ
 * `compact` は「前 / p / N / 次」だけの詰めた形(範囲の文を別に出す画面向け)。`usePageJump` はどちらの形・送り方とも組める
 */
export default function Pagination({
  page,
  perPage,
  total,
  makeHref,
  onPageChange,
  usePageJump,
  compact = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const go = { makeHref, onPageChange };

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-sm whitespace-nowrap" data-slot="pagination-compact">
        <PageControl {...go} page={currentPage - 1} variant="ghost" disabled={currentPage <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </PageControl>
        <span className="px-1 tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <PageControl
          {...go}
          page={currentPage + 1}
          variant="ghost"
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </PageControl>
        {usePageJump && <PageJumpInput currentPage={currentPage} totalPages={totalPages} {...go} />}
      </div>
    );
  }

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
  return (
    <div className="flex items-center gap-1 text-sm whitespace-nowrap">
      <span className="mr-2 whitespace-nowrap">
        {start} - {end} （{total}件中）
      </span>
      {showFirst && (
        <PageControl {...go} page={1} variant="ghost" aria-label="First page">
          <ChevronsLeft className="size-4" />
        </PageControl>
      )}
      {showPrev && (
        <PageControl {...go} page={Math.max(1, currentPage - 1)} variant="ghost" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </PageControl>
      )}
      {pages.map((p) =>
        p === currentPage ? (
          <span key={p} className="px-2 font-bold">
            {p}
          </span>
        ) : (
          <PageControl key={p} {...go} page={p} variant="outline">
            {p}
          </PageControl>
        ),
      )}
      {showNext && (
        <PageControl {...go} page={Math.min(totalPages, currentPage + 1)} variant="ghost" aria-label="Next page">
          <ChevronRight className="size-4" />
        </PageControl>
      )}
      {showLast && (
        <PageControl {...go} page={totalPages} variant="ghost" aria-label="Last page">
          <ChevronsRight className="size-4" />
        </PageControl>
      )}
      {usePageJump && <PageJumpInput currentPage={currentPage} totalPages={totalPages} {...go} />}
    </div>
  );
}

function PageJumpInput({
  currentPage,
  totalPages,
  makeHref,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  makeHref?: (page: number) => string;
  onPageChange?: (page: number) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentPage));

  const handleJump = () => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > totalPages || parsed === currentPage) {
      setValue(String(currentPage));
      return;
    }
    if (makeHref) router.push(makeHref(parsed));
    else onPageChange?.(parsed);
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
