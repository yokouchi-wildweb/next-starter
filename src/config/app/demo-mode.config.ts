// src/config/app/demo-mode.config.ts

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
    '/assets',
  ],

  // リダイレクト先（デモログインページ）
  redirectTo: '/demo',

  /**
   * デモユーザー作成後に実行されるフック。
   * プロジェクト固有の関連レコード（サンプルデータ等）を挿入する。
   *
   * @param userId - 作成されたデモユーザーのID
   * @example
   * async onUserCreated(userId: string) {
   *   await sampleService.create({ userId, name: "サンプル" });
   * }
   */
  async onUserCreated(_userId: string): Promise<void> {
    // プロジェクトで拡張：関連レコードの挿入等
  },
};
