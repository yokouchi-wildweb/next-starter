// src/lib/tableSuite/table-variants.ts

// ============================================================
// 行の高さ（Row Height）
// ============================================================
export type RowHeight = "xs" | "sm" | "md" | "lg" | "xl";

export const ROW_HEIGHT_CLASS: Record<RowHeight, string> = {
  xs: "h-8",
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
  xl: "h-16",
};

// ============================================================
// セルパディング（Cell Padding）
// ============================================================
export type PaddingSize = "none" | "xs" | "sm" | "md" | "lg" | "xl";

export const PADDING_X_CLASS: Record<PaddingSize, string> = {
  none: "px-0",
  xs: "px-1",
  sm: "px-2",
  md: "px-3",
  lg: "px-4",
  xl: "px-6",
};

export const PADDING_Y_CLASS: Record<PaddingSize, string> = {
  none: "py-0",
  xs: "py-0.5",
  sm: "py-1",
  md: "py-1.5",
  lg: "py-2",
  xl: "py-3",
};

/**
 * パディングクラスを解決するユーティリティ
 */
export const resolvePaddingClass = (
  paddingX: PaddingSize = "sm",
  paddingY: PaddingSize = "none",
): string => {
  return `${PADDING_X_CLASS[paddingX]} ${PADDING_Y_CLASS[paddingY]}`;
};

// ============================================================
// カラム配置（Column Alignment）
// ============================================================
export type TableColumnAlignment = "left" | "center" | "right";

const COLUMN_TEXT_ALIGN_CLASS: Record<TableColumnAlignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const COLUMN_FLEX_ALIGN_CLASS: Record<TableColumnAlignment, string> = {
  left: "justify-start text-left",
  center: "justify-center text-center",
  right: "justify-end text-right",
};

export const resolveColumnTextAlignClass = (align?: TableColumnAlignment) => {
  if (!align) {
    return undefined;
  }
  return COLUMN_TEXT_ALIGN_CLASS[align];
};

export const resolveColumnFlexAlignClass = (align?: TableColumnAlignment) => {
  if (!align) {
    return undefined;
  }
  return COLUMN_FLEX_ALIGN_CLASS[align];
};
