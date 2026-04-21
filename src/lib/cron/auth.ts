// src/lib/cron/auth.ts
// cron エンドポイントの共通認証ヘルパー
//
// Vercel Cron / Upstash / 外部スケジューラのいずれからでも叩ける想定。
// 認証方式は Bearer トークン（Vercel Cron の公式推奨パターンに準拠）。
//
// 環境変数:
//   CRON_SECRET     本番/ステージング用のシークレット（必須）
//
// 開発環境では認証をバイパスする（ローカル開発の利便性のため）。

/**
 * cron リクエストを検証する
 *
 * - development: 常に true（ローカル開発用）
 * - production / preview: Authorization ヘッダで CRON_SECRET を検証
 *
 * CRON_SECRET が未設定の場合は本番でも false を返す（fail-closed）。
 */
export function verifyCronRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET が未設定のためリクエストを拒否します");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
