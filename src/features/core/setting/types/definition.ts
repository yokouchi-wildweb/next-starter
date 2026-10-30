// src/features/core/setting/types/definition.ts
// 設定のキーとセクションの定義の型(項目: ../fields/・../sections/、一覧は ../extensions/ の生成物)

import type { z } from "zod";

import type { FieldConfig } from "@/components/Form/Field/types";
import type { FieldGroup } from "@/components/Form/FieldRenderer";
import type { IconComponent } from "@/components/Icons";
import type { UserRoleType } from "@/features/core/user/types";

/** 設定画面の欄。無いキーは設定画面に出ず、使う画面の側が保存する */
export type SettingFieldUi = {
  /** 所属するセクションの key */
  section: string;
  /** セクションの中のグループの key */
  group?: string;
  /** セクションの中の並び(昇順) */
  order?: number;
  /** 入力部品の定義(name はキーの名前) */
  field: Omit<FieldConfig, "name">;
};

/** 1 キーの定義(fields/<キー>[.<fork の名前>].ts の export const field) */
export type SettingFieldDefinition = {
  /** 型・検証・既定値(.default() 必須) */
  schema: z.ZodTypeAny;
  /** GET /api/setting/public に出すか(既定 false) */
  public?: boolean;
  /** 書き込みと管理者向けの読みを許すロール(省略 = セクションの権限) */
  allowRoles?: UserRoleType[];
  /** 既定値の差し替え(override だけが使う) */
  default?: unknown;
  ui?: SettingFieldUi;
};

/** 上流のキーの隣の <キー>.override.ts で変えられる属性 */
export type SettingFieldOverride = Pick<SettingFieldDefinition, "ui" | "public" | "default" | "allowRoles">;

/** 1 セクションの定義(sections/<名前>[.<fork の名前>].ts の export const section) */
export type SettingSectionDefinition = {
  key: string;
  /** 管理メニュー・ページタイトルに表示する名前 */
  label: string;
  /** メニュー表示順(昇順) */
  order: number;
  icon?: IconComponent;
  /** 画面を開けるロール(省略 = 全員) */
  allowRoles?: UserRoleType[];
  description?: string;
  groups?: FieldGroup[];
};

/** 上流のセクションの隣の <名前>.override.ts で変えられる属性 */
export type SettingSectionOverride = Partial<Omit<SettingSectionDefinition, "key">>;
