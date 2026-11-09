// src/features/core/pairedDevice/config.ts
// 登録端末(pairedDevice)の設定(既定 + 上書き)。上書きは src/config/features/pairedDevice.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。
// 店舗に置くタブレットやキオスクなどの共有端末を、ユーザーアカウントとは別の認証主体として登録し、長期の端末トークン(httpOnly Cookie)で動かす。
// kind ごとの scope・管理権限・追加検証は ./kinds/ の項目で宣言する。詳細: ./README.md
// 機能の入切(enabled)はスイッチなので、門番の議会が移すまで src/config/app/paired-device.config.ts に残る

import override from "@/config/features/pairedDevice.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type PairedDeviceConfig = {
  cookie: {
    /** 端末トークンを入れる Cookie 名(ユーザーセッションの Cookie とは別) */
    name: string;
    /** 端末側から始めるペアリングの、承認待ちを照合する Cookie 名 */
    pendingPairingName: string;
  };
  token: {
    /**
     * 端末トークンの有効期間(日)。kind ごとに tokenMaxAgeDays で上書きできる。
     * 主要ブラウザは Cookie の寿命を 400 日で打ち切るため、それを上限の目安にする。
     */
    maxAgeDays: number;
    /**
     * 残りがこの日数を切った状態で端末がアクセスすると有効期限を延長し、Cookie を再発行する。
     * 使われ続けている端末は失効しない(スライディング方式)
     */
    refreshWhenRemainingDays: number;
    /**
     * 最後のアクセスからこの日数が経った端末を無効として扱う(null = 無効化しない)。
     * kind ごとに idleRevokeDays で上書きできる
     */
    idleRevokeDays: number | null;
  };
  /** lastSeenAt(最終アクセス時刻)の更新を間引く間隔(秒)。アクセスごとの書き込みを避ける */
  lastSeenThrottleSeconds: number;
  /**
   * 「オンライン」とみなす最終アクセスからの経過秒数(管理一覧の表示用)。
   * lastSeenThrottleSeconds より大きくすること
   */
  onlineThresholdSeconds: number;
  pairing: {
    /** ペアリングコードの文字数(Crockford Base32。8 文字 = 40 bit) */
    codeLength: number;
    /** ペアリングコードの有効期間(分) */
    ttlMinutes: number;
    /** 端末側から始めるペアリングで、端末が承認を確認しに来る間隔の目安(秒) */
    pollIntervalSeconds: number;
  };
};

const defaults: PairedDeviceConfig = {
  cookie: {
    name: "paired_device",
    pendingPairingName: "paired_device_pending",
  },
  token: {
    maxAgeDays: 400,
    refreshWhenRemainingDays: 30,
    idleRevokeDays: null,
  },
  lastSeenThrottleSeconds: 300,
  onlineThresholdSeconds: 600,
  pairing: {
    codeLength: 8,
    ttlMinutes: 10,
    pollIntervalSeconds: 3,
  },
};

export const pairedDeviceConfigDef = defineConfig(defaults, { label: "pairedDevice" });

/** 上書きのファイルの型(`export default { ... } satisfies PairedDeviceOverride`) */
export type PairedDeviceOverride<E extends object = Record<never, never>> = OverrideOf<typeof pairedDeviceConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const pairedDeviceConfig: PairedDeviceConfig = pairedDeviceConfigDef.compose(override);
