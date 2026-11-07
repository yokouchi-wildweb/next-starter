// src/lib/adminCommand/core/types.ts

import type { ComponentType, ReactNode } from "react";
import type { SessionUser } from "@/features/core/auth/entities/session";

import type { NavigationItem } from "../types";

/** 遅延読み込みの一覧の項目(生成物 src/app/_layout/adminCommand/extensions/) */
export type LazyItem<T> = {
  name: string;
  load: () => Promise<T>;
};

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
 * - Provider: カテゴリ固有の状態管理（コンテキスト）。包むのはパレットと GlobalComponent だけ（管理者になってから読むので画面全体は包めない）
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
  /**
   * 移動の候補の絞り込み(管理の枠の門番 useGate().filter)。null = 絞らない(管理の枠の外: 候補をそのまま出す、L2.4)。
   * 登録は AdminCommandGateBridge だけ(admin の守りの layout 2 つの中)
   */
  navigationFilter: NavigationFilter | null;
  /** 絞り込みを登録する(null で外す)。AdminCommandGateBridge だけが呼ぶ */
  setNavigationFilter: (filter: NavigationFilter | null) => void;
};

/** 移動の候補の絞り込み(閉じた機能の住所の行を除く。順は保つ) */
export type NavigationFilter = (items: readonly NavigationItem[]) => NavigationItem[];
