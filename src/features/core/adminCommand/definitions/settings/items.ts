// src/lib/adminCommand/definitions/settings/items.ts

import type { SettingFieldConfig } from "../../types";

/**
 * コマンドパレットから変更可能な設定項目の一覧
 * 新しい設定項目を追加する場合はここに追加する
 *
 * 注: 画像アップロードが必要な項目（adminHeaderLogoImageUrl等）は
 * コマンドパレットでは扱わず、設定画面から変更する
 */
export const settingFields: SettingFieldConfig[] = [
  {
    key: "adminListPerPage",
    label: "一覧表示件数",
    description: "管理画面の一覧で1ページに表示する件数",
    type: "number",
    placeholder: "1〜500の数値を入力",
    validation: {
      min: 1,
      max: 500,
    },
  },
];
