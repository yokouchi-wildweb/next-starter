// src/lib/tableSuite/types.ts

import type React from "react";

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

// ============================================================
// カラムソート
// ============================================================
export type SortDirection = "asc" | "desc";

export type SortState = {
  /** ソート対象のカラムキー */
  field: string;
  /** ソート方向 */
  direction: SortDirection;
};

export type ColumnSortProps = {
  /** 現在のソート状態 */
  sort?: SortState;
  /** ヘッダークリック時のコールバック */
  onSortChange?: (sort: SortState) => void;
};

/**
 * ヘッダークリック時の次のソート状態を算出する。
 * 同じフィールド → 方向を反転、別フィールド → asc で開始。
 */
export const resolveNextSort = (current: SortState | undefined, field: string): SortState => {
  if (current?.field === field && current.direction === "asc") {
    return { field, direction: "desc" };
  }
  return { field, direction: "asc" };
};

// ============================================================
// セルアクション
// ============================================================

/**
 * セルのクリックアクション設定
 */
export type CellAction<T> = {
  /**
   * セルクリック時のコールバック（popover 使用時は省略可）
   */
  onClick?: (item: T) => void;
  /**
   * ポップオーバーモード：CellClickOverlay をトリガーとして受け取り、ポップオーバーを返す
   * onClick の代わりに使用する
   */
  popover?: (item: T, trigger: React.ReactNode) => React.ReactNode;
  /**
   * 右端に表示するインジケーター。
   * デフォルト: 目のアイコン
   * ReactNode または関数を渡すことで自由にカスタマイズ可能（文字列、アイコン、コンポーネントなど）
   * 関数を渡すと行データに基づいて動的にインジケーターを生成できる
   */
  indicator?: React.ReactNode | ((item: T) => React.ReactNode);
  /**
   * セル全体をクリック領域にする（デフォルト: false）
   * true の場合、ホバー時にセル全体がオーバーレイされる
   */
  fullWidth?: boolean;
};

// ============================================================
// 全幅差し込み行
// ============================================================

/**
 * 全幅の差し込み行。
 * データ行とは独立した情報行（グループの空き枠表示・区切り・注釈など）を
 * 指定位置に挿入する。選択・行クリック・ソート・カラム描画の対象にはならない。
 */
export type FullWidthRow = {
  /** React key（データ行のキーと衝突しない一意値） */
  key: React.Key;
  /**
   * この index のデータ行の直後に挿入する。-1 で先頭。
   * items の範囲を超える値は末尾に丸められる。
   * ソート・ページ変更などで items が変わる際は、使用側が再計算する責任を持つ。
   */
  afterIndex: number;
  /** 行コンテンツ（全カラムを結合した1セルに描画される） */
  render: () => React.ReactNode;
  /** tr への追加クラス */
  className?: string;
};

/**
 * 全幅差し込み行を afterIndex ごとにグループ化する。
 * 範囲外の afterIndex は末尾（itemCount - 1）へ丸め、-1 は先頭を表す。
 * items が空のときはすべて -1（先頭）に集約される。
 */
export const groupFullWidthRowsByIndex = (
  fullWidthRows: FullWidthRow[] | undefined,
  itemCount: number,
): Map<number, FullWidthRow[]> => {
  const map = new Map<number, FullWidthRow[]>();
  if (!fullWidthRows || fullWidthRows.length === 0) {
    return map;
  }
  const lastIndex = itemCount - 1;
  for (const row of fullWidthRows) {
    const index = Math.max(-1, Math.min(row.afterIndex, lastIndex));
    const bucket = map.get(index);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(index, [row]);
    }
  }
  return map;
};
