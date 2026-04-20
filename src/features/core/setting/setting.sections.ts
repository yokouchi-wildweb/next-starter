// src/features/core/setting/setting.sections.ts
//
// システム設定のセクション（管理画面のサブページ単位）を定義するカタログ。
//
// ダウンストリームが新しい設定カテゴリを追加する場合は、本ファイルに
// セクションを1つ追加するだけで完結する（ページ/メニュー/フォームは自動生成）。
//
// 手順:
//   1. 設定項目のスキーマを `setting.extended.ts` に追加（Zod）
//   2. このファイル（`setting.sections.ts`）の `settingSections` にエントリを追加
//   3. 必要に応じて icon や権限を設定
//
// 注意:
//   - フィールド名は `SettingBaseSchema` もしくは `settingExtendedSchema` に存在する必要がある
//     （起動時に `validateSectionFields` が検証し、存在しない場合は throw する）
//   - `formInput: "custom"` で独自UIも使用可能

import type { FieldConfig } from "@/components/Form/Field/types";
import type { FieldGroup, InlineFieldGroup } from "@/components/Form/FieldRenderer";
import type { IconComponent } from "@/components/Icons";
import type { UserRoleType } from "@/features/core/user/types";
import { Sliders, Construction } from "lucide-react";

import { SettingBaseSchema } from "./entities/schema";
import { settingExtendedSchema } from "./setting.extended";

/**
 * システム設定の1セクション定義
 */
export type SettingSection = {
  /** 管理メニュー・ページタイトルに表示する名前 */
  label: string;
  /** メニュー表示順（昇順）。同値のときは定義順 */
  order: number;
  /** メニューアイコン（任意） */
  icon?: IconComponent;
  /** 許可ロール。未指定なら全員に表示される。メニュー・ページ両方に適用 */
  allowRoles?: UserRoleType[];
  /** 表示するフィールド定義（FieldRenderer 互換） */
  fields: FieldConfig[];
  /** セクション分け（FieldRenderer の fieldGroups） */
  fieldGroups?: FieldGroup[];
  /** 横並びグループ（FieldRenderer の inlineGroups） */
  inlineGroups?: InlineFieldGroup[];
};

export type SettingSectionKey = string;
export type SettingSectionMap = Record<SettingSectionKey, SettingSection>;

// ============================================
// セクションカタログ
// ============================================

export const settingSections: SettingSectionMap = {
  general: {
    label: "基本設定",
    order: 10,
    icon: Sliders,
    fields: [
      {
        name: "adminListPerPage",
        label: "一覧表示件数",
        formInput: "numberInput",
      },
    ],
  },
  maintenance: {
    label: "メンテナンス",
    order: 20,
    icon: Construction,
    fields: [
      {
        name: "maintenanceEnabled",
        label: "メンテナンスモード",
        formInput: "switchInput",
      },
      {
        name: "maintenanceStartAt",
        label: "開始日時",
        formInput: "datetimeInput",
        placeholder: "未指定なら有効化直後から",
      },
      {
        name: "maintenanceEndAt",
        label: "終了日時",
        formInput: "datetimeInput",
        placeholder: "未指定なら自動解除しない",
      },
    ],
  },
};

// ============================================
// 起動時バリデーション
// ============================================

/**
 * セクション定義で参照しているフィールド名が、実際のスキーマに存在するかを検証。
 * 整合性の崩れを起動時に検出するための安全弁。
 */
function validateSectionFields(sections: SettingSectionMap): void {
  const allowedKeys = new Set<string>([
    ...Object.keys(SettingBaseSchema.shape),
    ...Object.keys(settingExtendedSchema.shape),
  ]);

  for (const [sectionKey, section] of Object.entries(sections)) {
    for (const field of section.fields) {
      if (!allowedKeys.has(field.name)) {
        throw new Error(
          `[setting.sections] Section "${sectionKey}" references unknown field "${field.name}". ` +
            `Add it to SettingBaseSchema or settingExtendedSchema first.`,
        );
      }
    }
  }
}

validateSectionFields(settingSections);

// ============================================
// ヘルパー
// ============================================

/**
 * settingSections を order 昇順にソートして [key, section] の配列で返す
 */
export function listSettingSections(): Array<[SettingSectionKey, SettingSection]> {
  return Object.entries(settingSections).sort(([, a], [, b]) => a.order - b.order);
}

/**
 * デフォルトセクションのキー（order が最小のもの）
 * 直リンク `/admin/settings` からのリダイレクト先に使用
 */
export function getDefaultSettingSectionKey(): SettingSectionKey {
  const entries = listSettingSections();
  if (entries.length === 0) {
    throw new Error("[setting.sections] No setting sections defined");
  }
  return entries[0][0];
}
