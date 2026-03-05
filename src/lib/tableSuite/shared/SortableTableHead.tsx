// src/lib/tableSuite/shared/SortableTableHead.tsx

"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { TableHead } from "./TableHead";
import type { SortState } from "../types";
import { resolveNextSort } from "../types";

type SortableTableHeadProps = {
  /** ソート対象のキー。未指定の場合はソート不可（通常のヘッダーとして表示） */
  sortKey?: string;
  /** 現在のソート状態 */
  sort?: SortState;
  /** ソート変更コールバック */
  onSortChange?: (sort: SortState) => void;
  /** ヘッダーの内容 */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function SortableTableHead({
  sortKey,
  sort,
  onSortChange,
  children,
  className,
  style,
}: SortableTableHeadProps) {
  const isSortable = Boolean(sortKey && onSortChange);
  const isActive = isSortable && sort?.field === sortKey;

  const handleClick = () => {
    if (!sortKey || !onSortChange) return;
    onSortChange(resolveNextSort(sort, sortKey));
  };

  if (!isSortable) {
    return (
      <TableHead className={className} style={style}>
        {children}
      </TableHead>
    );
  }

  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      style={style}
      onClick={handleClick}
      aria-sort={isActive ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <SortIndicator isActive={isActive} direction={sort?.direction} />
      </span>
    </TableHead>
  );
}

function SortIndicator({
  isActive,
  direction,
}: {
  isActive: boolean;
  direction?: "asc" | "desc";
}) {
  const iconClass = "h-3.5 w-3.5 shrink-0";

  if (!isActive) {
    return <ArrowUpDown className={cn(iconClass, "text-muted-foreground/40")} aria-hidden="true" />;
  }

  if (direction === "asc") {
    return <ArrowUp className={cn(iconClass, "text-foreground")} aria-hidden="true" />;
  }

  return <ArrowDown className={cn(iconClass, "text-foreground")} aria-hidden="true" />;
}
