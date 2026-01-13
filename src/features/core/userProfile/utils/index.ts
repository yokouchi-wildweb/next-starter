// src/features/core/userProfile/utils/index.ts
// クライアント/サーバー共通のユーティリティのみエクスポート
// サーバー専用: createProfileBase, profileBaseHelpers は直接 import すること

export {
  type ProfileFieldTag,
  getProfileFields,
  getFieldsByTags,
  getRegistrationFields,
  getMyPageFields,
  getAdminFields,
} from "./profileFieldHelpers";
