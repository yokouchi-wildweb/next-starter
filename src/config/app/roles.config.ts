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
 * プロフィールフィールドの入力タイプ（domain.json の formInput と互換）
 * @see src/components/Form/DomainFieldRenderer/fieldMapper.ts
 */
export type ProfileFormInputType =
  | "textInput"
  | "numberInput"
  | "textarea"
  | "select"
  | "multiSelect"
  | "radio"
  | "checkbox"
  | "stepperInput"
  | "switchInput"
  | "dateInput"
  | "timeInput"
  | "datetimeInput"
  | "emailInput"
  | "passwordInput"
  | "mediaUploader"
  | "hidden";

/**
 * プロフィールフィールドの設定（domain.json の fields と互換性あり）
 * @see src/components/Form/DomainFieldRenderer/fieldMapper.ts DomainJsonField
 */
export type ProfileFieldConfig = {
  /** フィールド名（DBカラム名） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 入力タイプ（domain.json の formInput と同じ値） */
  formInput: ProfileFormInputType;
  /** フィールドの型（checkbox で array/boolean を区別する場合等） */
  fieldType?: "string" | "number" | "boolean" | "array" | "date";
  /** 必須かどうか */
  required: boolean;
  /** 本登録画面で入力させるか（profile固有） */
  showOnRegistration: boolean;
  /** プレースホルダー */
  placeholder?: string;
  /** 説明文（フィールド下に表示） */
  description?: string;
  /** セレクト/ラジオ/チェックボックス用のオプション */
  options?: readonly { value: string | number | boolean; label: string }[];
  /** メディアアップローダー用のパス */
  uploadPath?: string;
  /** メディアアップローダー用のヘルパーテキスト */
  helperText?: string;
  /** メディアアップローダー用のaccept属性 */
  accept?: string;
  /** 読み取り専用 */
  readonly?: boolean;
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
   * 全フィールドを定義（ユーザー編集可能 / 管理者のみ / フラグ 等）
   * - formInput: 入力タイプ（hidden で非表示、switchInput でトグル等）
   * - showOnRegistration: 登録時に表示するか
   * @see src/components/Form/DomainFieldRenderer - フォーム描画に使用
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
  {
    id: "contributor",
    label: "投稿者",
    category: "user",
    hasProfile: true,
    description: "コンテンツを投稿できる",
    profileFields: [
      // ユーザー編集可能フィールド
      {
        name: "organizationName",
        label: "組織名",
        formInput: "textInput",
        required: true,
        showOnRegistration: true,
        placeholder: "株式会社〇〇",
      },
      {
        name: "contactPhone",
        label: "連絡先電話番号",
        formInput: "textInput",
        required: false,
        showOnRegistration: false,
        placeholder: "090-0000-0000",
      },
      {
        name: "bio",
        label: "自己紹介",
        formInput: "textarea",
        required: false,
        showOnRegistration: true,
        placeholder: "活動内容などを入力してください",
      },
      // 管理者用フィールド（承認ワークフロー）
      {
        name: "isApproved",
        label: "承認状態",
        formInput: "hidden",
        fieldType: "boolean",
        required: false,
        showOnRegistration: false,
      },
      {
        name: "approvedAt",
        label: "承認日時",
        formInput: "hidden",
        fieldType: "date",
        required: false,
        showOnRegistration: false,
      },
      {
        name: "approvalNote",
        label: "承認メモ",
        formInput: "hidden",
        required: false,
        showOnRegistration: false,
      },
    ],
  },
];
