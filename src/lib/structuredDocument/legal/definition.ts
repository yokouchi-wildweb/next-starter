import type { VariableMap } from "../shared";

/**
 * リーガルドキュメント - 構造定義
 *
 * 利用規約、プライバシーポリシー、特商法表記など
 * 階層構造を持つ法的文書の構造を定義
 */

/**
 * 再帰的なセクション構造
 * - title省略 = 本文のみ（前文など）
 * - content省略 = 子セクションのみ持つ親セクション
 * - 両方あり = タイトル付き本文 + 子セクション
 */
export type LegalSection = {
  /** アンカーリンク用ID（任意） */
  id?: string;
  /** セクションタイトル（省略可） */
  title?: string;
  /** 本文（段落の配列、Markdownリンク記法対応） */
  content?: string[];
  /** 子セクション（再帰） */
  children?: LegalSection[];
};

/**
 * セクション番号のフォーマット
 */
export type LegalSectionNumbering = "article" | "numeric" | "none";

/**
 * 法的文書の日付設定
 */
export type LegalDocumentDates = {
  /** 制定日 */
  enactedAt?: string;
  /** 最終更新日 */
  lastUpdatedAt?: string;
};

/**
 * リーガルドキュメント
 */
export type LegalDocument = {
  /** 文書タイトル */
  title: string;
  /** セクション一覧 */
  sections: LegalSection[];
  /** トップレベルセクションの番号スタイル */
  sectionNumbering?: LegalSectionNumbering;
} & LegalDocumentDates;

/**
 * レンダラーのモード
 */
export type LegalRenderMode = "rich" | "plain";

/**
 * レンダラーのプロパティ
 */
export type LegalDocumentRendererProps = {
  /** 描画する文書 */
  document: LegalDocument;
  /** 描画モード（デフォルト: rich） */
  mode?: LegalRenderMode;
  /** 変数マップ（プレースホルダー置換用） */
  variables?: VariableMap;
  /** タイトルを表示するか（デフォルト: true） */
  showTitle?: boolean;
  /** 制定日を表示するか（デフォルト: true） */
  showEnactedAt?: boolean;
  /** スクロール領域として表示する場合の最大高さ */
  maxHeight?: string;
  /** カスタムクラス名 */
  className?: string;
};
