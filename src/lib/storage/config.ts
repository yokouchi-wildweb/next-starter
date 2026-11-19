// src/lib/storage/config.ts
//
// ファイルの保存の設定のうち lib/storage が読む値(読み取り署名の TTL・strip の描き直し)。既定 + 上書き。
// 上書きは src/config/lib/storage.config.ts(@lib-config/storage)。置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 発行期限・掃除などの台帳の値は持ち主 src/features/core/storageObject/config.ts(上書き src/config/features/storageObject.config.ts)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/storage";

export type StorageConfig = {
  /**
   * 非公開ファイルの読み取り用署名 URL の有効期間(秒)。
   * GET /api/storage/objects/[id] が都度認可したうえで、この期間の署名 URL へ 302 する。
   * image / file = 画像・一般ファイル、video / audio = 動画・音声(シークで再取得が起きるため長め)、probe = サーバーでのメディア解析(mediaProbe)
   */
  readTtlSec: { image: number; file: number; video: number; audio: number; probe: number };
  /**
   * metadata: "strip" の用途で、commit 時にサーバーが画像を描き直すときの上限と品質(server/imageStrip.ts)。
   * maxFramePixels = 1 フレームの画素数の上限(幅 × 高さ、超えたら 422)、maxTotalPixels = 全フレームの画素数の合計の上限(超えたら 422)、
   * quality = 出力の品質(1〜100、png / gif は sharp の既定、用途の image.quality があればそちら)。縮小は用途ごとの image で決まる
   */
  imageStrip: {
    maxFramePixels: number;
    maxTotalPixels: number;
    quality: { jpeg: number; webp: number; avif: number };
  };
};

const defaults: StorageConfig = {
  readTtlSec: { image: 300, file: 300, video: 900, audio: 900, probe: 120 },
  imageStrip: {
    maxFramePixels: 100_000_000,
    maxTotalPixels: 100_000_000,
    quality: { jpeg: 90, webp: 90, avif: 60 },
  },
};

export const storageConfigDef = defineConfig(defaults, { label: "storage" });

/** 上書きのファイルの型(`export default { ... } satisfies StorageOverride`) */
export type StorageOverride<E extends object = Record<never, never>> = OverrideOf<typeof storageConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const storageConfig: StorageConfig = storageConfigDef.compose(override);
