// src/features/core/referral/lib/inviteLinkCookie.ts
//
// 招待リンク（?invite=CODE）の招待コードを保持する専用 cookie（edge-safe）。
//
// 責務の分離:
// - 紹介リワードの「機能」（プリフィル / 本登録時の自動適用）はこの専用 cookie が担い、
//   APP_FEATURES.marketing.referral.enabled のみでゲートされる
// - 流入経路の「解析」（タッチ記録・source/medium 集計）は userAcquisition が担い、
//   ACQUISITION_CONFIG.enabled でゲートされる
// 招待リンクは解析機能のオンオフに関係なく動作する。
//
// proxy（蓄積側）と API ルート（読み取り側）の両方から import されるため、
// このファイルは drizzle / postgres 等のサーバー専用モジュールを import しないこと。

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";

/**
 * 保留中の招待コードを保持する cookie 名。
 * httpOnly のため JS からは読めず、読み書きはサーバーサイドのみ
 * （proxy で保存 → pending-invite-code API / register で読み取り・削除）。
 */
export const INVITE_LINK_COOKIE_NAME = "pending_invite";

/**
 * 招待コード cookie の有効期間（日）。
 * 新しい招待リンクを踏むたびに上書き = リフレッシュされる（last-touch 優先）。
 */
export const INVITE_LINK_COOKIE_MAX_AGE_DAYS = 30;

/**
 * URL から招待コードを取り出す。
 * パラメータ名の語彙は解析側（userAcquisition の extras キー）と揃えるため
 * ACQUISITION_CONFIG.referralParam.param を共有定義として参照する。
 */
export function readInviteLinkParam(url: URL): string | null {
  const value = url.searchParams.get(ACQUISITION_CONFIG.referralParam.param)?.trim();
  if (!value) return null;
  // 異常値の cookie / DB 流入を防ぐため切り詰める（コードの実在検証は redeem 側が担う）
  return value.slice(0, 200);
}

/**
 * URL 文字列に招待リンクパラメータを付与する。
 *
 * 用途: メール認証リンク（continueUrl）への引き継ぎ。
 * cookie はブラウザをまたげないため（例: X アプリ内ブラウザで招待リンクを踏み、
 * 認証メールをデフォルトブラウザで開くケース）、メールリンクの URL にコードを
 * 埋め込み、開いた先のブラウザで proxy（inviteLinkDecorator）に cookie を
 * 焼き直させることで紹介を成立させる。email の別ブラウザ対策と同じ手法。
 */
export function appendInviteLinkParam(url: string, code: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${ACQUISITION_CONFIG.referralParam.param}=${encodeURIComponent(code)}`;
}
