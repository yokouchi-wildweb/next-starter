// src/config/maintenance.config.ts

/**
 * メンテナンスモードの設定
 * サービスイン前の事前登録期間など、特定ページ以外へのアクセスを制限する
 */
export const maintenanceConfig = {
  // メンテナンスモードの有効/無効
  enabled: false,

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

  // リダイレクト先
  redirectTo: '/maintenance',
};
