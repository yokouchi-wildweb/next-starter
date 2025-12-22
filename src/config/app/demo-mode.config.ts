// src/config/demo-mode.config.ts

/**
 * デモモードの設定
 * 有効時、デモユーザー以外はデモページの入り口にリダイレクトされる
 */
export const demoModeConfig = {
  // デモモードの有効/無効
  enabled: false,

  // デモモード中もアクセス許可するパス（完全一致）
  allowedPaths: [
    '/demo',
  ],

  // 前方一致で許可するパス
  allowedPrefixes: [
    '/_next',
    '/api/auth',
  ],

  // リダイレクト先（デモログインページ）
  redirectTo: '/demo',
};
