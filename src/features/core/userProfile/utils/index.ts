// src/features/core/userProfile/utils/index.ts
// クライアント/サーバー共通のユーティリティのみエクスポート
// サーバー専用: createProfileBase, profileBaseHelpers は直接 import すること

// ProfileFieldTag は types から直接インポートを推奨
export { type ProfileFieldTag } from "../types";

export {
  getProfileFields,
  getFieldsByTags,
  getRegistrationFields,
  getMyPageFields,
  getAdminFields,
} from "./profileFieldHelpers";
