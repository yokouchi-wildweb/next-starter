// src/features/core/userTag/constants/colors.ts

/**
 * タグカラーのスタイルマッピング
 * テーマカラー: CSS変数に連動（ダークモード自動対応）
 * スタンダードカラー: Tailwind カラーパレット
 */

export type TagColorStyle = {
  /** 背景色クラス */
  bg: string;
  /** テキスト色クラス（背景色上のテキスト） */
  text: string;
  /** ボーダー色クラス */
  border: string;
};

export const TAG_COLOR_STYLES: Record<string, TagColorStyle> = {
  // テーマカラー
  primary: { bg: "bg-primary", text: "text-primary-foreground", border: "border-primary" },
  secondary: { bg: "bg-secondary", text: "text-secondary-foreground", border: "border-secondary" },
  accent: { bg: "bg-accent", text: "text-accent-foreground", border: "border-accent" },
  success: { bg: "bg-success", text: "text-success-foreground", border: "border-success" },
  warning: { bg: "bg-warning", text: "text-warning-foreground", border: "border-warning" },
  destructive: { bg: "bg-destructive", text: "text-white", border: "border-destructive" },
  // スタンダードカラー
  red: { bg: "bg-red-500", text: "text-white", border: "border-red-500" },
  orange: { bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
  yellow: { bg: "bg-yellow-400", text: "text-yellow-900", border: "border-yellow-400" },
  green: { bg: "bg-green-500", text: "text-white", border: "border-green-500" },
  blue: { bg: "bg-blue-500", text: "text-white", border: "border-blue-500" },
  purple: { bg: "bg-purple-500", text: "text-white", border: "border-purple-500" },
  pink: { bg: "bg-pink-500", text: "text-white", border: "border-pink-500" },
  gray: { bg: "bg-gray-400", text: "text-white", border: "border-gray-400" },
};

/** カラー値からスタイルを取得（未設定時はデフォルト） */
export function getTagColorStyle(color: string | null | undefined): TagColorStyle | null {
  if (!color) return null;
  return TAG_COLOR_STYLES[color] ?? null;
}
