// src/config/app/storage.config.ts

/**
 * Storage（ファイル保存）の運用値のうち、lib/storage が読む値（読み取り署名の TTL・strip の描き直し）。
 * 発行期限・掃除などの台帳の値は持ち主 src/features/core/storageObject/config.ts へ移った（上書き: src/config/features/storageObject.config.ts）。
 *
 * 判定・処理のロジックは src/lib/storage と features/core/storageObject が持ち、ここは値だけを置く。
 * 下流プロジェクトは値を調整してよい（キーの追加・削除・型の変更は upstream の承認が要る）。
 * 仕組みの説明: src/lib/storage/README.md
 */

export const STORAGE_CONFIG = {
  /**
   * 非公開ファイルの読み取り用署名 URL の有効期間（秒）。
   * GET /api/storage/objects/[id] が都度認可したうえで、この期間の署名 URL へ 302 する。
   * - image / file: 画像・一般ファイル
   * - video / audio: 動画・音声（シークで再取得が起きるため長め）
   * - probe: サーバーでのメディア解析（mediaProbe）用
   */
  readTtlSec: {
    image: 300,
    file: 300,
    video: 900,
    audio: 900,
    probe: 120,
  },

  /**
   * metadata: "strip" の用途で、commit 時にサーバーが画像を描き直すときの上限と品質（src/lib/storage/server/imageStrip.ts）。
   * - maxFramePixels: 1 フレームの画素数の上限（幅 × 高さ）。超えたら 422
   * - maxTotalPixels: 全フレームの画素数の合計の上限（アニメーション GIF / WebP）。超えたら 422
   * - quality: 出力の品質（1〜100）。png / gif は sharp の既定。用途の image.quality があればそちら
   * 縮小は用途ごとの image（画像の縮小の指定、src/lib/storage/README.md「画像の縮小の指定」）で決まる（ここには持たない）
   */
  imageStrip: {
    maxFramePixels: 100_000_000,
    maxTotalPixels: 100_000_000,
    quality: {
      jpeg: 90,
      webp: 90,
      avif: 60,
    },
  },
} as const;

export type StorageConfig = typeof STORAGE_CONFIG;
