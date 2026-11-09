// src/config/app/paired-device.config.ts

/**
 * 登録端末（pairedDevice）の設定
 *
 * 機能の入切（enabled）だけが残る。ほかの値（Cookie・トークン・ペアリング・間隔）は
 * 持ち主 src/features/core/pairedDevice/config.ts（上書き src/config/features/pairedDevice.config.ts）。
 * 詳細: src/features/core/pairedDevice/README.md
 */
export const PAIRED_DEVICE_CONFIG = {
  /**
   * 機能の有効化。デフォルト無効（オプトイン）。
   * false の間は feature-gate がルートを 404 にし、db:push はテーブルを作らず、
   * 端末セッションの解決は Cookie を読まずに常に null を返す。
   */
  enabled: false,
} as const;
