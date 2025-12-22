// src/config/maintenance.config.ts

/**
 * メンテナンスモードの設定
 * サービスイン前の事前登録期間など、特定ページ以外へのアクセスを制限する
 */
export const maintenanceConfig = {
  // メンテナンスモードの有効/無効
  enabled: false,

  // メンテナンス中もアクセス許可するパス（完全一致）
  allowedPaths: [
    '/maintenance',
    '/pre-register', // ダミー（下流プロジェクトで実際のパスに変更）
  ],

  // 前方一致で許可するパス
  allowedPrefixes: [
    '/_next',
    '/api/auth',
  ],

  // バイパスできるロール（これらのロールを持つユーザーは制限を受けない）
  bypassRoles: ['admin'] as const,

  // リダイレクト先
  redirectTo: '/maintenance',
};
