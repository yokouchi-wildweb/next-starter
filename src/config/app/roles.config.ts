// src/config/app/roles.config.ts
// ダウンストリームでロールを追加する場合はこのファイルを編集してください。
// 追加後は drizzle-kit push でDBスキーマを更新する必要があります。
//
// 注意: コアロール（admin, user）はシステムで保護されており、
// このファイルでは追加ロールのみを定義します。

/**
 * 追加ロールの定義
 */
export const ADDITIONAL_ROLES: readonly {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}[] = [
  // 例: イベントの投稿者
  // {
  //   id: "organizer",
  //   label: "主催者",
  //   description: "イベントを作成・管理できる"
  // },
];
