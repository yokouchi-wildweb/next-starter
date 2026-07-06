// src/features/core/userAcquisition/constants/index.ts

/**
 * タッチ履歴を蓄積する cookie 名。
 * httpOnly のため JS からは読めず、読み書きは proxy（蓄積）と
 * /api/auth/register（確定保存 + 削除）のサーバーサイドのみ。
 */
export const ACQUISITION_COOKIE_NAME = "acq_touches";

/**
 * cookie ペイロードのスキーマバージョン。
 * 構造を変えるときにインクリメントし、旧バージョンは読み捨てる。
 */
export const ACQUISITION_COOKIE_VERSION = 1;

/**
 * cookie のシリアライズ後サイズ上限（バイト）。
 * ブラウザの 4KB 制限に対し、他 cookie との同居余地を残して控えめにする。
 * 超過時は first-touch を残して古い中間タッチから間引く。
 */
export const ACQUISITION_COOKIE_MAX_BYTES = 3000;

/**
 * UTM が無くリファラーも無い場合には touch を記録しないが、
 * 外部リファラーのみの流入は GA の慣例に合わせて medium="referral" とする。
 */
export const REFERRAL_MEDIUM = "referral";
