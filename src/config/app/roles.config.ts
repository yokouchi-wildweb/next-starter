// src/config/app/roles.config.ts
// ダウンストリームでロールを追加する場合はこのファイルを編集してください。
// 追加後は drizzle-kit push でDBスキーマを更新する必要があります。
//
// 注意: コアロール（admin, user）はシステムで保護されており、
// このファイルでは追加ロールのみを定義します。

/**
 * ロールカテゴリ
 * - admin: システム管理権限を持つロール（管理画面のsystem一覧に表示）
 * - user: 一般利用者ロール（管理画面のgeneral一覧に表示）
 */
export type RoleCategory = "admin" | "user";

/**
 * プロフィールフィールドの入力タイプ
 */
export type ProfileFieldInputType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "tel"
  | "url"
  | "select"
  | "multiSelect"
  | "checkbox"
  | "date"
  | "datetime";

/**
 * プロフィールフィールドの設定
 */
export type ProfileFieldConfig = {
  /** フィールド名（DBカラム名） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 入力タイプ */
  type: ProfileFieldInputType;
  /** 必須かどうか */
  required: boolean;
  /** 本登録画面で入力させるか */
  showOnRegistration: boolean;
  /** プレースホルダー */
  placeholder?: string;
  /** 説明文 */
  description?: string;
  /** セレクト用のオプション */
  options?: readonly { value: string; label: string }[];
};

/**
 * 追加ロールの定義型
 */
export type AdditionalRoleConfig = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
  /**
   * プロフィールフィールド設定（hasProfile: true の場合に定義）
   * 定義後は src/features/core/userProfile/entities/tables/ にテーブルを作成してください。
   */
  readonly profileFields?: readonly ProfileFieldConfig[];
};

/**
 * 追加ロールの定義
 */
export const ADDITIONAL_ROLES: readonly AdditionalRoleConfig[] = [
  {
    id: "editor",
    label: "編集者",
    category: "admin",
    hasProfile: false,
    description: "一部の設定を操作できる",
  },
  // 例: イベントの投稿者
  // {
  //   id: "organizer",
  //   label: "主催者",
  //   category: "user",
  //   hasProfile: true,
  //   description: "イベントを作成・管理できる",
  //   profileFields: [
  //     {
  //       name: "companyName",
  //       label: "会社名",
  //       type: "text",
  //       required: true,
  //       showOnRegistration: true,
  //       placeholder: "株式会社〇〇",
  //     },
  //     {
  //       name: "contactPhone",
  //       label: "連絡先電話番号",
  //       type: "tel",
  //       required: false,
  //       showOnRegistration: true,
  //     },
  //   ],
  // },
];
