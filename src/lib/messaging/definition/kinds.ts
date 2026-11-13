// src/lib/messaging/definition/kinds.ts
//
// 種別(kind)の 7 つと性質の表(D80)。種別は種類(category)が持ち、連絡の定義は種別を書かない(D81)。
// 種別の値で分ける読み手(配信停止の判定・お知らせの見え方・検査・管理の送信の宛先・本文の残し方の既定)は、
// 種別の文字列を比べずにこの表を引く(fork は種別を増やせない)。

/** 種別(lib の型。fork は増やせない) */
export const MESSAGE_KINDS = [
  "functional",
  "transactional",
  "security",
  "announcement",
  "direct",
  "activity",
  "marketing",
] as const;

/**
 * 種別
 * - functional: 機能に組み込まれた連絡(メールアドレスの確認・パスワードの再設定など)
 * - transactional: 本人の手続きの知らせ(会員登録の完了・失効した等)
 * - security: セキュリティの警告(アカウントのロックなど)
 * - announcement: 運営の告知
 * - direct: 運営から特定の利用者への直接の連絡
 * - activity: 利用者が止められる、サービスの利用に伴う知らせ(いいね・リマインダー・失効の予告など)
 * - marketing: 宣伝
 */
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** 管理者がその場で書いて送れる宛先(管理の送る画面と一覧の一括) */
export type MessageAdminAudience = "all" | "role" | "audience" | "users" | "bulk";

/** 本文の残し方(types.ts の MessageRecord と同じ語彙) */
type RecordDefault = "meta" | "vars" | "full";

/** 種別の性質(D80) */
export type MessageKindTraits = {
  /** fork が上流のこの種別の連絡を override で止め(enabled:false)・経路を外せるか(functional の上流の物だけ不可、D68) */
  upstreamDisable: boolean;
  /** 利用者の停止・好み・停止のヘッダと本文の停止リンクに従うか(activity・marketing) */
  userStoppable: boolean;
  /** 住所の停止のどれに従うか: hardBounce = hard bounce だけ(苦情の停止を越えて届ける)/ all = 苦情・ワンクリック・手作業も */
  addressStop: "hardBounce" | "all";
  /** 管理者がその場で書いて送れる宛先(空 = コードの定義からだけ) */
  adminFreeText: readonly MessageAdminAudience[];
  /** 本文の残し方の既定(定義の record が無い時) */
  recordDefault: RecordDefault;
  /** 管理画面で文言を直せるか(adminEditable) */
  adminTextOverride: boolean;
  /** 会話の間引き(throttle)を付けられるか */
  throttle: boolean;
  /** 種類の経路の上書きで email を外せないか(functional・security のメール、D86) */
  emailFixed: boolean;
};

const BASE: MessageKindTraits = {
  upstreamDisable: true,
  userStoppable: false,
  addressStop: "all",
  adminFreeText: [],
  recordDefault: "vars",
  adminTextOverride: true,
  throttle: true,
  emailFixed: false,
};

/** 種別ごとの性質の表(D80。細部は計画書 04) */
export const MESSAGE_KIND_TRAITS: Readonly<Record<MessageKind, MessageKindTraits>> = {
  functional: {
    ...BASE,
    upstreamDisable: false,
    addressStop: "hardBounce",
    recordDefault: "meta",
    adminTextOverride: false,
    throttle: false,
    emailFixed: true,
  },
  transactional: { ...BASE },
  security: { ...BASE, addressStop: "hardBounce", recordDefault: "meta", throttle: false, emailFixed: true },
  announcement: { ...BASE, adminFreeText: ["all", "role", "audience", "users"], recordDefault: "full" },
  direct: { ...BASE, adminFreeText: ["users", "bulk"], recordDefault: "full" },
  activity: { ...BASE, userStoppable: true },
  marketing: { ...BASE, userStoppable: true, adminFreeText: ["all", "role", "audience", "users", "bulk"] },
};

export function isMessageKind(value: unknown): value is MessageKind {
  return typeof value === "string" && (MESSAGE_KINDS as readonly string[]).includes(value);
}

/** 種別の性質(知らない値は null) */
export function kindTraits(kind: string | null | undefined): MessageKindTraits | null {
  return isMessageKind(kind) ? MESSAGE_KIND_TRAITS[kind] : null;
}

/** 性質を満たす種別の一覧(SQL の IN や画面の選択肢に使う) */
export function kindsWhere(predicate: (traits: MessageKindTraits) => boolean): MessageKind[] {
  return MESSAGE_KINDS.filter((kind) => predicate(MESSAGE_KIND_TRAITS[kind]));
}
