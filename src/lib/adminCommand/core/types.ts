// src/lib/adminCommand/core/types.ts

import type { ComponentType, ReactNode } from "react";
import type { SessionUser } from "@/features/core/auth/entities/session";

/**
 * カテゴリレンダラーが受け取る共通Props
 */
export type CategoryRendererProps = {
  /** パレットを閉じる */
  onClose: () => void;
  /** 第1メニュー（ルート）に戻る */
  onBack: () => void;
  /** 現在のユーザー情報 */
  user: SessionUser;
};

/**
 * パレットの表示状態
 */
export type PaletteView =
  | { type: "root" }
  | { type: "category"; categoryId: string };

/**
 * カテゴリの設定
 */
export type CategoryConfig = {
  /** カテゴリID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 説明文 */
  description?: string;
  /** アイコン */
  icon?: ReactNode;
  /** カスタムレンダラー */
  Renderer: ComponentType<CategoryRendererProps>;
};

/**
 * プラグイン設定
 *
 * カテゴリに以下が必要な場合に使用:
 * - Provider: カテゴリ固有の状態管理（コンテキスト）
 * - GlobalComponent: パレット外で常時表示するUI（ダイアログなど）
 */
export type AdminCommandPlugin = {
  /** プラグインID（カテゴリIDと一致させることを推奨） */
  id: string;
  /** カテゴリ固有のProvider */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** パレット外で常時表示するコンポーネント */
  GlobalComponent?: ComponentType;
};

/**
 * AdminCommandContext の値
 */
export type AdminCommandContextValue = {
  /** パレットを開く */
  openPalette: () => void;
  /** パレットを閉じる */
  closePalette: () => void;
  /** パレットの開閉状態を切り替える */
  togglePalette: () => void;
  /** パレットが開いているかどうか */
  isOpen: boolean;
};
