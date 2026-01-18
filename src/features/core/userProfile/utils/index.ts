// src/features/core/userProfile/utils/index.ts
// クライアント/サーバー共通のユーティリティ
// サーバー専用: createProfileBase, profileBaseHelpers は直接 import すること

// 型
export { type ProfileFieldTag } from "../types";

// スキーマ関連（Zodスキーマ操作 + バリデーション）
export {
  getProfileSchema,
  pickSchemaByTag,
  createProfileDataValidator,
} from "./schemaHelpers";

// フィールド関連（フィールド配列操作）
export {
  pickFieldsByTag,
  getFieldConfigsForForm,
  getFieldConfigsForFormAsArray,
  type GetFieldConfigsForFormOptions,
} from "./fieldHelpers";

// 設定取得関連
export {
  getProfilesByCategory,
  getProfileConfig,
} from "./configHelpers";
