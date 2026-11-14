// src/features/core/messaging/services/server/unsubscribe/token.ts
//
// ワンクリックの配信停止の署名つきトークン(D35、ログイン不要の URL)。
// token = base64url(JSON {v:1, r: recipient_key, c: category, ch: channel, a?: address_hash, mk?: message_key, d?: dispatch_id}) + "." + base64url(HMAC-SHA256(鍵, 前半))
// mk / d = 停止を連絡・回に結ぶ値(集計の軸)。後から足したので無いトークン(前に送ったメール)も同じ版で通る(無い = null)
// 鍵 = env MESSAGING_UNSUBSCRIBE_SECRET(pnpm ops setup env が乱数で作る)。鍵が無い時は作れない(送る口が marketing・activity の
// メールを明示の失敗にする)し、届いたトークンも通さない。
// URL(事業の素性の url(@/business)は使わない。どちらも getAppBaseUrl() + 住所 + ?token=<token>):
// - One-Click の POST の先 = /api/messaging/unsubscribe(List-Unsubscribe のヘッダ。RFC 8058 のメールソフトがここへ POST する)
// - 人が開く住所 = /unsubscribe(確認のページ。メールの本文のリンク)

import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppBaseUrl } from "@/lib/url";

export const UNSUBSCRIBE_SECRET_ENV = "MESSAGING_UNSUBSCRIBE_SECRET";
/** One-Click の POST の先(API) */
export const UNSUBSCRIBE_PATH = "/api/messaging/unsubscribe";
/** 人が開く確認のページ */
export const UNSUBSCRIBE_PAGE_PATH = "/unsubscribe";
/** トークンを渡す引数の名前(API とページで同じ) */
export const UNSUBSCRIBE_TOKEN_PARAM = "token";
const TOKEN_VERSION = 1;

/** トークンの中身 */
export type UnsubscribeTokenPayload = {
  /** 受信者の鍵(user:<id> | addr:<正規化した宛先の sha256>) */
  recipientKey: string;
  /** 止める種類の鍵 */
  category: string;
  /** 止める経路の鍵 */
  channel: string;
  /** 宛先の hash(宛先だけの受信者の停止に使う) */
  addressHash?: string;
  /** 送った連絡の鍵(前に作ったトークンには無い) */
  messageKey?: string;
  /** 送った回の id(前に作ったトークンには無い) */
  dispatchId?: string;
};

type WirePayload = { v: number; r: string; c: string; ch: string; a?: string; mk?: string; d?: string };

const RECIPIENT_KEY_PATTERN = /^(user:[0-9a-f-]{36}|addr:[0-9a-f]{64})$/;
const KEY_PATTERN = /^[A-Za-z0-9_.*-]{1,64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret(): string | null {
  const value = process.env[UNSUBSCRIBE_SECRET_ENV]?.trim();
  return value ? value : null;
}

/** 鍵の env が置かれているか */
export function isUnsubscribeConfigured(): boolean {
  return secret() !== null;
}

function sign(key: string, body: string): Buffer {
  return createHmac("sha256", key).update(body).digest();
}

function isValidPayload(payload: UnsubscribeTokenPayload): boolean {
  return (
    RECIPIENT_KEY_PATTERN.test(payload.recipientKey) &&
    KEY_PATTERN.test(payload.category) &&
    KEY_PATTERN.test(payload.channel) &&
    (payload.addressHash === undefined || HASH_PATTERN.test(payload.addressHash)) &&
    (payload.messageKey === undefined || (payload.messageKey.length <= 128 && MESSAGE_KEY_PATTERN.test(payload.messageKey))) &&
    (payload.dispatchId === undefined || UUID_PATTERN.test(payload.dispatchId))
  );
}

/**
 * トークンを作る。
 * @throws Error 鍵の env が無い・中身の形が合わない(呼び手のコードの誤り)
 */
export function signUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  const key = secret();
  if (!key) throw new Error(`${UNSUBSCRIBE_SECRET_ENV} が設定されていません`);
  if (!isValidPayload(payload)) throw new Error("配信停止のトークンの中身の形が正しくありません");
  const wire: WirePayload = {
    v: TOKEN_VERSION,
    r: payload.recipientKey,
    c: payload.category,
    ch: payload.channel,
    ...(payload.addressHash ? { a: payload.addressHash } : {}),
    ...(payload.messageKey ? { mk: payload.messageKey } : {}),
    ...(payload.dispatchId ? { d: payload.dispatchId } : {}),
  };
  const body = Buffer.from(JSON.stringify(wire), "utf8").toString("base64url");
  return `${body}.${sign(key, body).toString("base64url")}`;
}

/** トークンを確かめて中身を返す(鍵が無い・形の誤り・署名の不一致・版の違いは null) */
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribeTokenPayload | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, signature] = parts;
  const expected = sign(key, body);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let wire: unknown;
  try {
    wire = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!wire || typeof wire !== "object") return null;
  const { v, r, c, ch, a, mk, d } = wire as Partial<WirePayload>;
  if (v !== TOKEN_VERSION || typeof r !== "string" || typeof c !== "string" || typeof ch !== "string") return null;
  if (a !== undefined && typeof a !== "string") return null;
  if ((mk !== undefined && typeof mk !== "string") || (d !== undefined && typeof d !== "string")) return null;
  const payload: UnsubscribeTokenPayload = {
    recipientKey: r,
    category: c,
    channel: ch,
    ...(a ? { addressHash: a } : {}),
    ...(mk ? { messageKey: mk } : {}),
    ...(d ? { dispatchId: d } : {}),
  };
  return isValidPayload(payload) ? payload : null;
}

/** One-Click の POST の先の URL(List-Unsubscribe のヘッダ) */
export function buildUnsubscribeUrl(payload: UnsubscribeTokenPayload): string {
  const url = new URL(UNSUBSCRIBE_PATH, getAppBaseUrl());
  url.searchParams.set(UNSUBSCRIBE_TOKEN_PARAM, signUnsubscribeToken(payload));
  return url.toString();
}

/** 人が開く確認のページの URL(メールの本文のリンク) */
export function buildUnsubscribePageUrl(payload: UnsubscribeTokenPayload): string {
  const url = new URL(UNSUBSCRIBE_PAGE_PATH, getAppBaseUrl());
  url.searchParams.set(UNSUBSCRIBE_TOKEN_PARAM, signUnsubscribeToken(payload));
  return url.toString();
}

/**
 * One-Click の URL(ヘッダの値、<> 付きでもよい)を同じトークンの確認のページの URL にする。
 * メールの項目が本文のリンクを作る時に使う(ヘッダの URL しか持たないため)。読めなければ null
 */
export function unsubscribePageUrlOf(oneClickUrl: string): string | null {
  try {
    const url = new URL(oneClickUrl.replace(/^<|>$/g, ""));
    const token = url.searchParams.get(UNSUBSCRIBE_TOKEN_PARAM);
    if (!token) return null;
    const page = new URL(UNSUBSCRIBE_PAGE_PATH, url.origin);
    page.searchParams.set(UNSUBSCRIBE_TOKEN_PARAM, token);
    return page.toString();
  } catch {
    return null;
  }
}
