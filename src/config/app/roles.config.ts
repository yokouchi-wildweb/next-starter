// src/config/app/roles.config.ts
// ダウンストリームでロールを追加する場合はこのファイルを編集してください。
// 追加後は drizzle-kit push でDBスキーマを更新する必要があります。
//
// 注意: コアロール（admin, user）はシステムで保護されており、
// このファイルでは追加ロールのみを定義します。

import type {
  AdditionalRoleConfig,
  CoreProfileFieldTag,
  CoreRoleId,
  CoreRoleExtension,
} from "@/features/core/user/types";

// ============================================================
// ユーザー拡張可能なプロフィールフィールドタグ
// ============================================================
// notification 以外のカスタムタグを追加できます。
// コアタグ（admin, registration, mypage）はシステムで保護されています。

export const ADDITIONAL_PROFILE_FIELD_TAGS = [
  // 例 通知設定用のフィールド
  "notification",

] as const;
export type AdditionalProfileFieldTag = (typeof ADDITIONAL_PROFILE_FIELD_TAGS)[number];

/**
 * 全てのプロフィールフィールドタグ（コア + 追加）
 */
export type ProfileFieldTag = CoreProfileFieldTag | AdditionalProfileFieldTag;

// ============================================================
// コアロールの拡張設定
// ============================================================
// コアロール（admin, user）にプロフィールフィールドを追加する場合はここで定義します。
// hasProfile: true を設定するとプロフィールテーブルが有効になります。

export const CORE_ROLE_EXTENSIONS: Record<
  CoreRoleId,
  CoreRoleExtension<ProfileFieldTag>
> = {
  admin: {
    // 管理者ロールにプロフィールを追加する場合
    // hasProfile: true,
    // profileFields: [
    //   { name: "department", label: "部署", fieldType: "string", formInput: "textInput", tags: ["admin"] },
    // ],
  },
  user: {
    // 一般ユーザーロールにプロフィールを追加する場合
    // hasProfile: true,
    // profileFields: [
    //   { name: "nickname", label: "ニックネーム", fieldType: "string", formInput: "textInput", tags: ["registration", "mypage"] },
    // ],
  },
};

// ============================================================
// 追加ロールの定義
// ============================================================
// コアロール（admin, user）以外のロールをここで定義します。

export const ADDITIONAL_ROLES: readonly AdditionalRoleConfig<ProfileFieldTag>[] = [
  {
    id: "editor",
    label: "編集者",
    category: "admin",
    hasProfile: false,
    description: "一部の設定を操作できる",
  },
  {
    id: "contributor",
    label: "投稿者",
    category: "user",
    hasProfile: true,
    description: "コンテンツを投稿できる",
    profileFields: [
      // ユーザー編集可能フィールド
      {
        name: "organization_name",
        label: "組織名",
        fieldType: "string",
        formInput: "textInput",
        required: true,
        placeholder: "株式会社〇〇",
        tags: ["registration", "mypage"],
      },
      {
        name: "contact_phone",
        label: "連絡先電話番号",
        fieldType: "string",
        formInput: "textInput",
        placeholder: "090-0000-0000",
        tags: ["mypage"],
      },
      {
        name: "bio",
        label: "自己紹介",
        fieldType: "string",
        formInput: "textarea",
        placeholder: "活動内容などを入力してください",
        tags: ["registration", "mypage"],
      },
      // 管理者用フィールド（承認ワークフロー）
      {
        name: "is_approved",
        label: "承認状態",
        fieldType: "boolean",
        formInput: "hidden",
        tags: ["admin"],
      },
      {
        name: "approved_at",
        label: "承認日時",
        fieldType: "timestamp With Time Zone",
        formInput: "hidden",
        tags: ["admin"],
      },
      {
        name: "approval_note",
        label: "承認メモ",
        fieldType: "string",
        formInput: "textarea",
        tags: ["admin"],
      },
    ],
  },
];
