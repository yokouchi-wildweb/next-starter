// src/lib/sortableList/types.ts

import type { TableColumnAlignment, RowHeight, PaddingSize } from "./variants";

// ============================================================
// 行クラス解決
// ============================================================
type TableRowClassContext = {
  index: number;
  selected?: boolean;
};

type RowClassNameResolver<T> =
  | string
  | ((item: T, context: TableRowClassContext) => string | undefined);

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
// SortableList 固有の型
// ============================================================

/**
 * ソート可能なアイテムの基本インターフェース
 * id は必須（ドラッグ&ドロップの識別子として使用）
 */
export type SortableItem = {
  id: string;
};

/**
 * SortableList のカラム定義
 */
export type SortableListColumn<T> = {
  /**
   * カラムヘッダー（省略可能）
   */
  header?: React.ReactNode;
  /**
   * セル内容のレンダリング関数
   */
  render: (item: T) => React.ReactNode;
  /**
   * テキスト配置
   */
  align?: TableColumnAlignment;
  /**
   * カラムの幅（Tailwindのwidth class または CSS値）
   * 例: "w-20", "80px", "auto"
   */
  width?: string;
  /**
   * このカラムの水平パディングを上書き
   */
  paddingX?: PaddingSize;
  /**
   * このカラムの垂直パディングを上書き
   */
  paddingY?: PaddingSize;
};

/**
 * 並び替え完了時のコールバック引数
 */
export type ReorderResult = {
  /**
   * 移動したアイテムのID
   */
  itemId: string;
  /**
   * 移動先の直前のアイテムID（先頭に移動した場合は null）
   */
  afterItemId: string | null;
  /**
   * 移動先の直後のアイテムID（末尾に移動した場合は null）
   */
  beforeItemId: string | null;
  /**
   * 移動先のインデックス（UIローカルの順序）
   */
  newIndex: number;
  /**
   * 移動元のインデックス
   */
  oldIndex: number;
};

/**
 * SortableList コンポーネントの Props
 */
export type SortableListProps<T extends SortableItem> = {
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
   * 表示するアイテムの配列
   */
  items: T[];
  /**
   * カラム定義
   */
  columns: SortableListColumn<T>[];
  /**
   * 並び替え完了時のコールバック
   */
  onReorder: (result: ReorderResult) => void;
  /**
   * ドラッグハンドルを表示するか
   * @default true
   */
  showDragHandle?: boolean;
  /**
   * ドラッグ中のアイテムに適用するクラス
   */
  draggingClassName?: string;
  /**
   * ドラッグオーバー中のアイテムに適用するクラス
   */
  dragOverClassName?: string;
  /**
   * 空の場合に表示するメッセージ
   */
  emptyMessage?: string;
  /**
   * ローディング中かどうか
   */
  isLoading?: boolean;
  /**
   * ドラッグ無効化
   */
  disabled?: boolean;
  /**
   * アイテム単位のドラッグ無効化判定
   * true を返すアイテムはドラッグ不可（SortableContext から除外される）
   */
  isItemDisabled?: (item: T) => boolean;
  /**
   * アイテムの高さ。デフォルト: "md"
   */
  itemHeight?: RowHeight;
  /**
   * アイテムの水平パディング。デフォルト: "sm" (px-2)
   */
  itemPaddingX?: PaddingSize;
  /**
   * アイテムの垂直パディング。デフォルト: "none"
   */
  itemPaddingY?: PaddingSize;
};

/**
 * SortableItem コンポーネントの Props
 */
export type SortableItemProps<T extends SortableItem> = {
  item: T;
  columns: SortableListColumn<T>[];
  showDragHandle: boolean;
  draggingClassName?: string;
  rowClassName?: string;
  disabled?: boolean;
  itemHeight: RowHeight;
  itemPaddingX: PaddingSize;
  itemPaddingY: PaddingSize;
};
