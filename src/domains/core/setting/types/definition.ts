// src/domains/core/setting/types/definition.ts
// 設定のキーとセクションの定義の型(項目: ../fields/・../sections/、一覧は ../extensions/ の生成物)

import type { z } from "zod";

import type { FieldConfig } from "@/lib/formSuite";
import type { FieldGroup } from "@/lib/formSuite";
import type { IconComponent } from "@/components/Icons/types";
import type { FeatureName } from "@/featureGate";
import type { UserRoleType } from "@/domains/core/user/types";

type SettingFieldUiPlace = {
  /** 所属するセクションの key */
  section: string;
  /** セクションの中のグループの key */
  group?: string;
  /** セクションの中の並び(昇順) */
  order?: number;
};

/**
 * 設定画面の欄。無いキーは設定画面に出ず、使う画面の側が保存する。
 * 1 つの欄(field)か、部分を持つキーの部分ごとの欄(parts)のどちらか
 */
export type SettingFieldUi = SettingFieldUiPlace &
  (
    | {
        /** 入力部品の定義(name はキーの名前) */
        field: Omit<FieldConfig, "name">;
        parts?: undefined;
      }
    | {
        field?: undefined;
        /**
         * 部分を持つキー(schema が z.object)の欄。部分ごとに 1 つの欄を並べる(名前は <キー>.<部分>)。
         * 片方だけ変えると意味が壊れる値は部分を持つ 1 つのキーにする(札 items/domains/setting.md one_key_groups)
         */
        parts: Readonly<Record<string, SettingFieldPartUi>>;
      }
  );

/** 部分を持つキーの 1 つの部分の欄 */
export type SettingFieldPartUi = {
  /** キーの中の並び(昇順) */
  order?: number;
  /** 入力部品の定義(name は <キー>.<部分>) */
  field: Omit<FieldConfig, "name">;
};

/** 1 キーの定義(fields/<キー>.ts の export const field) */
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

/** 1 セクションの定義(sections/<名前>.ts の export const section) */
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
  /**
   * この節が属する機能(規則名)。1 つでも閉じていれば /admin/settings/<key> が閉じる(管理メニューの行も消える)。
   * 生成器が字面で読み規則の住所に足す(文字列リテラルかその配列で書く。src/featureGate/README.md)。override では変えない
   */
  feature?: FeatureName | FeatureName[];
};

/** 上流のセクションの隣の <名前>.override.ts で変えられる属性 */
export type SettingSectionOverride = Partial<Omit<SettingSectionDefinition, "key">>;
