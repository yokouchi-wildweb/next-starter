// 生成物・編集不可: pnpm generate extensions が src/lib/mail/extensionPoints.ts・backend-selection.json から生成する
// mail: 口 mail の選んだ実装 "resend"(backend-selection.json)。選ばない実装は読まない

export { adapter } from "../plugs/mail/resend";

/** 選択表が選んだ実装の名前 */
export const selected = "resend" as const;
/** 今の設定の読み方(宣言の select.compat の写し) */
export const compat = {"from":"env","name":"MAIL_PROVIDER","map":{"sendgrid":"sendgrid","resend":"resend"},"default":"resend"} as const;
