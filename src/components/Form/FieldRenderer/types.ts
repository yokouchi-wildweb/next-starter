// src/components/Form/FieldRenderer/types.ts
// FieldRenderer 固有の型定義

import type { ReactNode } from "react";

import type { FieldConfig as FieldConfigType } from "@/components/Form/Field/types";

// Field/types.ts から共通型を re-export
export type {
  FormInputType,
  FieldDataType,
  FieldDataTypeFirestore,
  FieldOption,
  MediaValidationRule,
  FieldConfig,
} from "@/components/Form/Field/types";

// ファイル内で使用するための型エイリアス
type FieldConfig = FieldConfigType;

/**
 * メディアアップロード状態（集約版）
 * 複数のメディアフィールドの状態を集約して管理
 */
export type MediaState = {
  /** いずれかのメディアがアップロード中か */
  isUploading: boolean;
  /** すべてのメディアをコミット */
  commitAll: () => Promise<void>;
  /** すべてのメディアをリセット */
  resetAll: () => Promise<void>;
};

/**
 * 単一メディアフィールドのハンドル
 * ConfiguredMediaField から親に通知される
 */
export type MediaHandleEntry = {
  /** アップロード中か */
  isUploading: boolean;
  /** メディアをコミット（アップロード確定、古いメディア削除） */
  commit: (finalUrl?: string | null) => Promise<void>;
  /** メディアをリセット（アップロードキャンセル） */
  reset: () => Promise<void>;
};

/**
 * フィールドグループ定義（セクション分け用）
 * @see src/components/Form/FieldRenderer/README.md - fieldGroups（セクション分け）
 * @see src/features/README.md - FieldGroup（フィールドグループ）※domain.json スキーマ
 */
export type FieldGroup = {
  /** グループキー（一意識別子） */
  key: string;
  /** 表示ラベル */
  label: string;
  /** グループに含むフィールド名の配列 */
  fields: string[];
  /** 折りたたみ可能か（デフォルト: false） */
  collapsible?: boolean;
  /** 初期状態で折りたたむか（デフォルト: false） */
  defaultCollapsed?: boolean;
  /** 背景色（CSSカラーコード形式、例: "#f5f5f5", "rgba(0,0,0,0.05)"） */
  bgColor?: string;
};

/**
 * グループ外フィールド枠（fieldGroups のいずれにも属さないフィールドのまとまり）を
 * beforeGroup / afterGroup で指定するための予約キー
 */
export const UNGROUPED_GROUP_KEY = "__ungrouped__";

/**
 * グループ単位のUI差し込みマップ（beforeGroup / afterGroup 用）
 * - キー: FieldGroup.key または UNGROUPED_GROUP_KEY（グループ外フィールド枠）
 * - 値: 差し込む ReactNode
 * - fieldGroups 未指定（フラット表示）時は無視される
 * @see src/components/Form/FieldRenderer/README.md - beforeGroup / afterGroup
 */
export type GroupContentMap = Partial<Record<string, ReactNode>>;

/**
 * インラインフィールドグループ定義（横並び表示用）
 * 複数フィールドを1つのフィールドのように横並びで表示する
 */
export type InlineFieldGroup = {
  /** グループキー（一意識別子） */
  key: string;
  /** グループラベル（FieldItemのラベルと同じ見た目） */
  label: string;
  /** グループに含むフィールド名の配列（順序通りに横並び表示） */
  fields: string[];
  /** 各フィールドの幅（Tailwindクラス、例: ["w-24", "w-20", "w-20"]）省略時は均等 */
  fieldWidths?: string[];
  /** フィールドが必須かどうか */
  required?: boolean;
  /** 説明テキスト */
  description?: {
    text: string;
    tone?: "muted" | "danger" | "warning" | "success";
    size?: "sm" | "xs";
    placement?: "before" | "after";
  };
};

/**
 * フィールド挿入位置指定マップ
 * キー: 挿入先フィールド名 または "__first__" / "__last__"
 * 値: 挿入するフィールド設定の配列
 *
 * @example
 * // 先頭に挿入
 * { __first__: [{ name: "category_id", ... }] }
 *
 * // 特定フィールドの前/後に挿入
 * { name: [{ name: "name_kana", ... }] }
 */
export type InsertFieldsMap = Partial<Record<string, FieldConfig[]>>;
