// src/config/app/demo-mode.config.ts

/**
 * デモモードの設定
 * 有効時、デモユーザー以外はデモページの入り口にリダイレクトされる
 *
 * デモ入り口画面の表記を変更したい場合:
 * → src/app/(user)/demo/page.tsx を編集してください
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
    '/api',
    '/admin',
    '/assets',
  ],

  // リダイレクト先（デモログインページ）
  redirectTo: '/demo',

};
