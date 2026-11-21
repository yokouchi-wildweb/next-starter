// src/config/lib/storage.config.ts
// ファイルの保存の設定の上書き(@lib-config/storage)。キーと既定: src/lib/storage/config.ts
// - 保存先と公開 base は env を読む引数なしの関数のまま(lib が使うたびに呼ぶ)。公開 base の NEXT_PUBLIC_* は本体のこの字面のまま(client ではビルド時に埋め込まれる)
// - 読み取り署名の TTL・strip の描き直しは値で書く(既定のままなら書かない)
import type { StorageOverride } from "@/lib/storage";

export default {
  publicBaseUrl: () => process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL,
  stores: {
    pub: { bucket: () => process.env.STORAGE_PUBLIC_BUCKET, prefix: () => process.env.STORAGE_PUBLIC_PREFIX },
    priv: { bucket: () => process.env.STORAGE_PRIVATE_BUCKET, prefix: () => process.env.STORAGE_PRIVATE_PREFIX },
    legacy: { bucket: () => process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET },
  },
} satisfies StorageOverride;
