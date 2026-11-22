// src/domains/core/messaging/hooks/messagingKeys.ts
//
// messaging の SWR のキー(ドメインに 1 つのキーのファイル、core/client.md swr_keys)。hook はキーの文字を自分で組まず、ここの名前を読む。
// useDomainMutation の頭(mutate を通る)もキーとしてここに置く。SWR でない文字(プレビューの頼みの印・好みの欄の id・localStorage の鍵)は置かない。
// 一覧・配達・受け取り箱の一覧は useInfiniteScrollQuery の状態で SWR の外(画面が revalidate / updateItems を呼ぶ)

// ---- 管理: 送信 ----

export const ADMIN_MESSAGING_KEY = "messaging/admin";
export const ADMIN_DISPATCHES_KEY = `${ADMIN_MESSAGING_KEY}/dispatches`;

/** 送信の画面の絞りの選択肢(カテゴリー)のキー */
export const ADMIN_DISPATCH_CATEGORIES_KEY = `${ADMIN_DISPATCHES_KEY}/categories`;
/** 送信の一覧の絞りの選択肢(送り元・送った人)のキー */
export const ADMIN_DISPATCH_FILTER_OPTIONS_KEY = `${ADMIN_DISPATCHES_KEY}/filters`;
/** 送信のまとめての削除(mutation) */
export const ADMIN_DISPATCHES_BULK_DELETE_KEY = `${ADMIN_DISPATCHES_KEY}/bulk-delete`;
/** 削除の見込み(送信の id の組ごと。id は並べて , でつなぐ) */
export const ADMIN_DISPATCH_DELETE_SUMMARY_KEY = `${ADMIN_MESSAGING_KEY}/delete-summary`;
/** 送信 1 件のキー */
export const adminDispatchKey = (id: string) => `${ADMIN_DISPATCHES_KEY}/${id}`;
/** 送信 1 件のプレビュー(送信の中身を残した送信) */
export const adminDispatchPreviewKey = (id: string) => `${adminDispatchKey(id)}/preview`;
/** 送信 1 件の削除・再送・送信の再開・予約の直し(mutation) */
export const adminDispatchDeleteKey = (id: string) => `${adminDispatchKey(id)}/delete`;
export const adminDispatchResendKey = (id: string) => `${adminDispatchKey(id)}/resend`;
export const adminDispatchContinueKey = (id: string) => `${adminDispatchKey(id)}/continue`;
export const adminDispatchEditKey = (id: string) => `${adminDispatchKey(id)}/edit`;
/** 予約の直しの材料(edit-options) */
export const scheduledEditOptionsKey = (dispatchId: string) => `${adminDispatchKey(dispatchId)}/edit-options`;

// ---- 管理: 一括送信(一覧の選んだ記録へ) ----

export const ADMIN_BULK_SEND_KEY = `${ADMIN_MESSAGING_KEY}/bulk-send`;
export const ADMIN_BULK_SEND_OPTIONS_KEY = `${ADMIN_BULK_SEND_KEY}/options`;
/** 送るモーダルの bulk の送る(mutation) */
export const ADMIN_BULK_SEND_MODAL_KEY = `${ADMIN_BULK_SEND_KEY}/modal`;

// ---- 管理: 送る画面(自由連絡・定義連絡・受け取れる送信チャンネル)。送ったら送信のキーも再検証する ----

export const ADMIN_SEND_KEY = "messaging/admin/send";
export const ADMIN_SEND_OPTIONS_KEY = `${ADMIN_SEND_KEY}/options`;
/** 送る画面の部品の mutation(useSendPreview・useSendTest の name: preview / test など) */
export const adminSendActionKey = (name: string) => `${ADMIN_SEND_KEY}/${name}`;
/** 自由連絡の送るモーダルの人数の見込み・送る(mutation) */
export const ADMIN_SEND_MODAL_ESTIMATE_KEY = `${ADMIN_SEND_KEY}/modal/estimate`;
export const ADMIN_SEND_MODAL_SEND_KEY = `${ADMIN_SEND_KEY}/modal/send`;
/** 定義連絡の送る口(送る・プレビュー・テストの mutation の頭) */
export const ADMIN_DEFINITION_SEND_KEY = "messaging/admin/definitions";
/** 定義連絡の送る・人数の見込み(mutation) */
export const ADMIN_DEFINITION_SEND_SEND_KEY = `${ADMIN_DEFINITION_SEND_KEY}/send`;
export const ADMIN_DEFINITION_ESTIMATE_KEY = `${ADMIN_DEFINITION_SEND_KEY}/estimate`;

/** 定義連絡の選択肢(記録の入口の項目の鍵か、全員・ロール・グループの入口) */
export function definitionOptionsKey(query: { recordTarget: string } | { entry: "broadcast" }): string {
  return "recordTarget" in query
    ? `${ADMIN_DEFINITION_SEND_KEY}/options?recordTarget=${encodeURIComponent(query.recordTarget)}`
    : `${ADMIN_DEFINITION_SEND_KEY}/options?entry=broadcast`;
}

/** 1 人の受け取れる送信チャンネル(条件ごと) */
export function recipientChannelsKey(userId: string, query: { message?: string; category?: string } = {}): string {
  const condition = query.message !== undefined ? `?message=${encodeURIComponent(query.message)}` : query.category !== undefined ? `?category=${encodeURIComponent(query.category)}` : "";
  return `${ADMIN_MESSAGING_KEY}/recipients/${encodeURIComponent(userId)}/channels${condition}`;
}

// ---- 管理: 保存されたテンプレート。保存(= 公開、D134)は 1 件・版・一覧(画面が revalidate)を取り直す。削除(D137)は一覧だけ ----

export const MESSAGE_TEMPLATES_KEY = "messaging/admin/templates";
export const MESSAGE_TEMPLATE_OPTIONS_KEY = `${MESSAGE_TEMPLATES_KEY}/options`;
/** 作る(mutation) */
export const MESSAGE_TEMPLATE_CREATE_KEY = `${MESSAGE_TEMPLATES_KEY}/create`;
/** 送る画面の『テンプレートを更新』(mutation、D120) */
export const MESSAGE_TEMPLATE_SEND_UPDATE_KEY = `${MESSAGE_TEMPLATES_KEY}/send-update`;

/** 1 件のキー */
export const messageTemplateKey = (id: string) => `${MESSAGE_TEMPLATES_KEY}/${id}`;
/** 版の一覧のキー */
export const messageTemplateVersionsKey = (id: string) => `${messageTemplateKey(id)}/versions`;
/** 版 1 つのキー */
export const messageTemplateVersionKey = (id: string, version: number) => `${messageTemplateVersionsKey(id)}/${version}`;
/** 直す・削除(mutation。作る前の書きかけは "new") */
export const messageTemplateUpdateKey = (id: string | null) => `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/update`;
export const messageTemplateDeleteKey = (id: string | null) => `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/delete`;

// ---- 管理: テキストの編集(上書き)。保存・既定に戻すは 1 連絡と一覧の両方を再検証する ----

export const MESSAGE_OVERRIDES_KEY = "messaging/admin/overrides";
/** 1 連絡のキー */
export const messageOverrideKey = (key: string) => `${MESSAGE_OVERRIDES_KEY}/${key}`;
/** 1 連絡の保存(mutation) */
export const messageOverrideSaveKey = (key: string) => `${messageOverrideKey(key)}/save`;

// ---- 利用者: 受け取り箱。既読の mutation は未読数のキーを再検証する ----

export const INBOX_KEY = "messaging/inbox";
export const INBOX_UNREAD_COUNT_KEY = `${INBOX_KEY}/unread-count`;
/** 既読にする・全部既読にする(mutation) */
export const INBOX_READ_KEY = `${INBOX_KEY}/read`;
export const INBOX_READ_ALL_KEY = `${INBOX_KEY}/read-all`;
/** お知らせ 1 件 */
export const inboxItemDetailKey = (id: string) => `${INBOX_KEY}/item/${id}`;

// ---- 利用者: 連絡先・受け取りの設定・配信停止 ----

export const MESSAGE_ENDPOINTS_KEY = "messaging/endpoints";
export const MESSAGE_ENDPOINTS_REGISTER_KEY = `${MESSAGE_ENDPOINTS_KEY}/register`;
export const MESSAGE_ENDPOINTS_REMOVE_KEY = `${MESSAGE_ENDPOINTS_KEY}/remove`;
export const MESSAGE_PREFERENCES_KEY = "messaging/preferences";
export const MESSAGE_PREFERENCES_SET_KEY = `${MESSAGE_PREFERENCES_KEY}/set`;
/** 配信停止のページ(mutation) */
export const MESSAGE_UNSUBSCRIBE_KEY = "messaging/unsubscribe";
