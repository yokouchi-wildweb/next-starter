// src/lib/url/getAppBaseUrl.ts

import { businessConfig } from "@/config/business.config";

/**
 * businessConfig.url のプレースホルダー値。
 * fork 直後の未設定状態を検出するために使用する。
 */
const PLACEHOLDER_URL = "https://example.com";

/**
 * アプリの実行環境におけるベースURLを返す。
 *
 * 用途:
 * - 決済プロバイダに渡す success_url / cancel_url
 * - メール本文に埋め込むリンク
 * - その他「外部に公開される自分のオリジン」を組み立てる必要があるすべての箇所
 *
 * 優先順位:
 *   1. process.env.APP_BASE_URL                   — 明示的上書き（dev / staging / ngrok 等）
 *   2. Vercel preview デプロイの自動検出 (VERCEL_URL) — PR プレビューが無設定で動くようにするため
 *   3. businessConfig.url                          — 本番環境のフォールバック
 *
 * リクエストヘッダ (Host / X-Forwarded-Host) からは決して導出しない。
 * → Host Header Injection 対策（決済コールバックURL改竄防止）
 *
 * @throws 設定値がプレースホルダーのまま、または不正なURL形式の場合
 */
export function getAppBaseUrl(): string {
  // 1. 明示的な上書き（最優先）
  //    dev: APP_BASE_URL=http://localhost:3000
  //    ngrok: APP_BASE_URL=https://xxxxxxxx.ngrok-free.app
  //    staging: APP_BASE_URL=https://staging.example.com
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return validateAndNormalize(explicit);
  }

  // 2. Vercel preview / branch デプロイの自動検出
  //    VERCEL_ENV === "production" の場合は custom domain を使うため businessConfig.url にフォールバック。
  //    preview の場合のみ Vercel 提供の VERCEL_URL を採用する。
  //    これにより PR プレビューが env 未設定でも正しいオリジンで動作する。
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return validateAndNormalize(`https://${process.env.VERCEL_URL}`);
  }

  // 3. 本番設定値へのフォールバック
  return validateAndNormalize(businessConfig.url);
}

/**
 * URL文字列を検証し、正規化（末尾スラッシュ除去）した値を返す。
 * プレースホルダーや不正なURL形式は明示的なエラーメッセージで throw する。
 */
function validateAndNormalize(raw: string): string {
  if (raw === PLACEHOLDER_URL) {
    throw new Error(
      "アプリのベースURLがプレースホルダー (https://example.com) のままです。" +
        "businessConfig.url を実環境のURLに更新するか、APP_BASE_URL 環境変数で上書きしてください。",
    );
  }

  try {
    new URL(raw);
  } catch {
    throw new Error(`アプリのベースURLが不正なURL形式です: ${raw}`);
  }

  // 末尾スラッシュを除去して正規化
  return raw.replace(/\/$/, "");
}
