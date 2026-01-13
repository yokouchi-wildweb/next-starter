// src/features/core/userProfile/types/fieldTag.ts
// プロフィールフィールドのタグ型

import {
  CORE_PROFILE_FIELD_TAGS,
  EXTRA_PROFILE_FIELD_TAGS,
  PROFILE_FIELD_TAGS,
} from "../constants/fieldTag";

/** コアタグ型 */
export type CoreProfileFieldTag = (typeof CORE_PROFILE_FIELD_TAGS)[number];

/** 追加タグ型 */
export type ExtraProfileFieldTag = (typeof EXTRA_PROFILE_FIELD_TAGS)[number];

/** 全タグ型 */
export type ProfileFieldTag = (typeof PROFILE_FIELD_TAGS)[number];
