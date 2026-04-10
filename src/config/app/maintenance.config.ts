// src/config/app/maintenance.config.ts

/**
 * 現在メンテナンス期間内かどうか判定
 */
export function isMaintenanceActive(): boolean {
  if (!maintenanceConfig.enabled) return false;

  const { start, end } = maintenanceConfig.schedule;
  const now = new Date();

  if (start && now < new Date(start)) return false;
  if (end && now >= new Date(end)) return false;

  return true;
}

/**
 * メンテナンスモードの設定
 * サービスイン前の事前登録期間など、特定ページ以外へのアクセスを制限する
 */
export const maintenanceConfig = {
  // メンテナンスモードの有効/無効
  enabled: true,

  // スケジュール設定（enabled: true の場合のみ有効）
  // null = 制限なし
  schedule: {
    start: null as string | null, // 開始時刻（ISO8601形式）例: '2025-01-27T10:00:00+09:00'
    end: null as string | null, // 終了時刻（ISO8601形式）例: '2025-01-27T14:00:00+09:00'
  },

  // メンテナンス中もアクセス許可するパス（完全一致）
  allowedPaths: [
    '/maintenance',
    '/entry',
    '/login',
    '/logout',
    '/admin/login',
    '/signup',
    '/signup/oauth',
    '/signup/email-sent',
    '/signup/verify',
    '/signup/register',
    '/signup/complete',
    '/privacy-policy',
    '/terms',
    '/tradelaw',
  ],

  // 前方一致で許可するパス
  allowedPrefixes: [
    '/_next',
    '/api',
    '/assets',
  ],

  // バイパスできるロール（これらのロールを持つユーザーは制限を受けない）
  bypassRoles: ['admin', 'debugger'] as const,

  // メンテナンス中のリダイレクト先
  redirectTo: '/maintenance',

  // メンテナンス終了後のリダイレクト先
  redirectAfterEnd: '/',
};
