// src/config/app/maintenance.config.ts

/**
 * メンテナンスモードの設定
 *
 * 有効フラグ・開始/終了日時は管理画面のシステム設定（DB）で管理する。
 * このファイルには、コードに依存する構造的な設定のみを残す。
 *
 * - 管理画面 UI: /admin/settings/maintenance
 * - サーバー判定: settingService.isMaintenanceActive()
 */
export const maintenanceConfig = {
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
