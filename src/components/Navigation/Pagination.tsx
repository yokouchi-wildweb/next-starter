// src/components/Common/Pagination.tsx
"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { LinkButton } from "@/components/Form/Button/LinkButton";

export type PaginationProps = {
  page: number;
  perPage: number;
  total: number;
  makeHref: (page: number) => string;
};

export default function Pagination({ page, perPage, total, makeHref }: PaginationProps) {
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
        <LinkButton href={firstHref} size="sm" variant="ghost" className="px-1" aria-label="First page">
          <ChevronsLeft className="size-4" />
        </LinkButton>
      )}
      {showPrev && (
        <LinkButton href={prevHref} size="sm" variant="ghost" className="px-1" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </LinkButton>
      )}
      {pages.map((p) =>
        p === currentPage ? (
          <span key={p} className="px-2 font-bold">
            {p}
          </span>
        ) : (
          <LinkButton key={p} href={makeHref(p)} size="sm" variant="outline" className="px-1">
            {p}
          </LinkButton>
        ),
      )}
      {showNext && (
        <LinkButton href={nextHref} size="sm" variant="ghost" className="px-1" aria-label="Next page">
          <ChevronRight className="size-4" />
        </LinkButton>
      )}
      {showLast && (
        <LinkButton href={lastHref} size="sm" variant="ghost" className="px-1" aria-label="Last page">
          <ChevronsRight className="size-4" />
        </LinkButton>
      )}
    </div>
  );
}
