// src/lib/storage/config.ts
//
// ファイルの保存の設定のうち lib/storage が読む値(保存先と公開 base・読み取り署名の TTL・strip の描き直し)。既定 + 上書き。
// 保存先と公開 base は env を読む引数なしの関数で受け、使うたびに呼ぶ(読み込み時には読まない。lib の中は env を読まない、設定 D249)
// - 公開(StoragePublicConfig): publicBaseUrl。上書きの関数の本体に env の NEXT_PUBLIC_* の字面(client ではビルド時に埋め込まれる)
// - server だけ(StorageServerConfig): stores の bucket / prefix。./server(server/stores.ts)の中でだけ呼ぶ
// 上書きは src/config/lib/storage.config.ts(@lib-config/storage)。置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 発行期限・掃除などの台帳の値は持ち主 src/features/core/storageObject/config.ts(上書き src/config/features/storageObject.config.ts)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/storage";

/** env を読む引数なしの関数(上書きは env を返すだけの矢印関数)。空・undefined = 未設定 */
export type StorageEnvValue = () => string | undefined;

/** client と server の両方が読む公開の値 */
export type StoragePublicConfig = {
  /** 公開ファイルの base URL(STORAGE_PUBLIC_PREFIX を含めた、オブジェクトキーの直前まで)。ref.ts が呼ぶたびに読む */
  publicBaseUrl: StorageEnvValue;
};

/** server だけの値: 保存先ごとのバケットと prefix(server/stores.ts が呼ぶたびに読む) */
export type StorageServerConfig = {
  stores: {
    /** 公開バケット(bucket 必須・prefix 任意) */
    pub: { bucket: StorageEnvValue; prefix: StorageEnvValue };
    /** 非公開バケット(bucket 必須・prefix 任意) */
    priv: { bucket: StorageEnvValue; prefix: StorageEnvValue };
    /** 旧バケット(ref には出さず、旧 URL の解析・削除・コピーにだけ使う) */
    legacy: { bucket: StorageEnvValue };
  };
};

export type StorageConfig = StoragePublicConfig & StorageServerConfig & {
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

const unset: StorageEnvValue = () => undefined;

const defaults: StorageConfig = {
  publicBaseUrl: unset,
  stores: {
    pub: { bucket: unset, prefix: unset },
    priv: { bucket: unset, prefix: unset },
    legacy: { bucket: unset },
  },
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

/** 合成済みの設定(読み込み時に 1 回作る。env の関数はここでは呼ばない) */
export const storageConfig: StorageConfig = storageConfigDef.compose(override);
