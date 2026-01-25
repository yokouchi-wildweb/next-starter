// src/lib/tableSuite/types.ts

// バリアント定義を再エクスポート
export {
  type RowHeight,
  ROW_HEIGHT_CLASS,
  type PaddingSize,
  PADDING_X_CLASS,
  PADDING_Y_CLASS,
  resolvePaddingClass,
  type TableColumnAlignment,
  resolveColumnTextAlignClass,
  resolveColumnFlexAlignClass,
} from "./table-variants";

import type { RowHeight, PaddingSize } from "./table-variants";

// ============================================================
// 共通Props
// ============================================================
export type TableCellStyleProps = {
  /**
   * 行の高さ。デフォルト: "md"
   */
  rowHeight?: RowHeight;
  /**
   * セルの水平パディング。デフォルト: "sm" (px-2)
   */
  cellPaddingX?: PaddingSize;
  /**
   * セルの垂直パディング。デフォルト: "none"
   */
  cellPaddingY?: PaddingSize;
};

// ============================================================
// 行クラス解決
// ============================================================
export type TableRowClassContext = {
  index: number;
  /**
   * RecordSelectionTable など、選択状態を持つテーブルが値を設定する。
   * DataTable / EditableGridTable のように選択状態を持たない場合は undefined。
   */
  selected?: boolean;
};

export type RowClassNameResolver<T> =
  | string
  | ((item: T, context: TableRowClassContext) => string | undefined);

export type TableStylingProps<T> = {
  /**
   * テーブル全体のラッパー div に適用されるクラス名。
   */
  className?: string;
  /**
   * テーブルラッパーの最大高さ。CSSの長さ表現で指定する。未指定時は 70vh。
   */
  maxHeight?: string;
  /**
   * 行単位で適用するクラス名。関数を渡すと行ごとに計算できる。
   */
  rowClassName?: RowClassNameResolver<T>;
  /**
   * スクロール領域のラッパー div を外部から参照したい場合に指定する。
   * IntersectionObserver の root 指定などで利用する。
   */
  scrollContainerRef?: React.Ref<HTMLDivElement>;
  /**
   * スクロール領域の最下部に sentinel を配置したい場合に指定する。
   * 無限スクロールなどで IntersectionObserver の target に利用できる。
   */
  bottomSentinelRef?: React.Ref<HTMLDivElement>;
};

export const resolveRowClassName = <T,>(
  rowClassName: RowClassNameResolver<T> | undefined,
  item: T,
  context: TableRowClassContext,
) => {
  if (!rowClassName) {
    return undefined;
  }
  if (typeof rowClassName === "function") {
    return rowClassName(item, context) ?? undefined;
  }
  return rowClassName;
};
