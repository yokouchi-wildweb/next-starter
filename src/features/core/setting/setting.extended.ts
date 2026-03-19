// src/features/core/setting/setting.extended.ts
//
// 拡張設定項目の定義ファイル
// ダウンストリームはこのファイルだけを編集して設定項目を追加する
//
// 使い方:
//   1. settingExtendedSchema に Zod フィールドを追加する
//   2. デフォルト値は .default() で指定する
//   3. DB マイグレーション不要（jsonb カラムに格納される）
//   4. UI は SettingForm 内で自由に構成する
//
// 例:
//   export const settingExtendedSchema = z.object({
//     siteTitle: z.string().nullish(),
//     maintenanceMode: z.coerce.boolean().default(false),
//     bonusTiers: z.array(z.object({
//       threshold: z.number(),
//       multiplier: z.number(),
//     })).default([]),
//   });

import { z } from "zod";

/**
 * 拡張設定項目のスキーマ
 *
 * ダウンストリームでフィールドを追加する場合はこの z.object() 内に定義する。
 * - バリデーション: Zod のメソッドチェーンで自由に定義
 * - デフォルト値: .default() で指定（getGlobalSetting() で自動適用される）
 * - 型: z.infer<typeof settingExtendedSchema> で自動導出
 */
export const settingExtendedSchema = z.object({
  // ダウンストリームでここにフィールドを追加する
});

/** 拡張設定項目の型（自動導出） */
export type SettingExtended = z.infer<typeof settingExtendedSchema>;
