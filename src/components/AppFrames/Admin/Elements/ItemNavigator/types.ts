// src/components/AppFrames/Admin/Elements/ItemNavigator/types.ts

/**
 * ItemNavigator(移るだけの選択欄)の Props。データは src/lib/crud の useDomainItemNavigation の戻り値をそのまま渡せる
 */
export type ItemNavigatorProps<T extends { id: string }> = {
  /** 選択可能なアイテム一覧(今の項目を含む) */
  items: T[];
  /** 現在選択中のアイテムID */
  currentId: string;
  /** アイテムの表示名を取得する関数 */
  getLabel: (item: T) => string;
  /** 遷移先パスを生成する関数 */
  getPath: (id: string) => string;
  /** 候補の読み込み中(選択欄を止める) */
  isLoading?: boolean;
  /** 無効化 */
  disabled?: boolean;
  /** ラベルテキスト（default: "切り替え"） */
  label?: string;
  /** プレースホルダー */
  placeholder?: string;
  /** ラベル(span)に足すクラス名。置き場に合わせて見た目から隠すときなどに使う(例: SP だけ max-sm:sr-only。読み上げには残る) */
  labelClassName?: string;
  /** 追加のクラス名 */
  className?: string;
  /** 選択欄(SelectInput)に足すクラス名。置き場に合わせた大きさの調整に使う(例: 管理のヘッダーの行に SP で収める) */
  selectClassName?: string;
};
