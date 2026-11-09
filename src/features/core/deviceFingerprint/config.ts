// src/features/core/deviceFingerprint/config.ts
// ブラウザフィンガープリントの収集(deviceFingerprint)の設定(既定 + 上書き)。上書きは src/config/features/deviceFingerprint.config.ts
// (このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig。
//
// 目的: 複数アカウント運用などの不正が疑われるユーザーを「デバイス軸」で突き合わせるための一次データ収集。
// userLoginEvent(IP = ネットワーク軸)の兄弟基盤で、両者を組み合わせて調査する(README の調査レシピ)。
// 注意: フィンガープリントはクライアント申告値であり偽装可能。「断定材料」ではなく「参考証拠」として扱う(README の脅威モデル)。
// collection.enabled は収集の opt-in(処理の切り替え)で、門番の規則 src/featureGate/rules/deviceFingerprint.ts は読まない(閉じる値とは別)

import override from "@/config/features/deviceFingerprint.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type DeviceFingerprintConfig = {
  /**
   * 全ページ設置型の収集(useFingerprintReport → POST /api/me/fingerprint)。
   * デフォルト無効。downstream で複垢検知が必要になったら true にする(オプトイン)。
   * 有効化した時点以降のアクセスから蓄積される(過去には遡及できない)。
   */
  collection: {
    enabled: boolean;
    /** device_fingerprints 行の既定保持期間(日)。行単位 retention + 日次 cron prune */
    retentionDays: number;
    /**
     * raw_signals (正規化前の生信号 JSONB) の保存上限バイト数。
     * 超過時は行自体は保存しつつ raw_signals のみ null に落とす(検索軸のハッシュ列は常に保存される)。
     */
    maxRawSignalsBytes: number;
  };
};

const defaults: DeviceFingerprintConfig = {
  collection: {
    enabled: false,
    retentionDays: 365,
    maxRawSignalsBytes: 32768,
  },
};

export const deviceFingerprintConfigDef = defineConfig(defaults, { label: "deviceFingerprint" });

/** 上書きのファイルの型(`export default { ... } satisfies DeviceFingerprintOverride`) */
export type DeviceFingerprintOverride<E extends object = Record<never, never>> = OverrideOf<typeof deviceFingerprintConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const deviceFingerprintConfig: DeviceFingerprintConfig = deviceFingerprintConfigDef.compose(override);
