// src/lib/dataMigration/config.ts
//
// データ移行の設定(既定 + 上書き)。上書きは src/config/lib/dataMigration.config.ts(@lib-config/dataMigration)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/dataMigration";

export type DataMigrationSettings = {
  /** 1 回の取り込み・書き出しの最大レコード数 */
  maxRecordLimit: number;
};

const defaults: DataMigrationSettings = {
  maxRecordLimit: 1000,
};

export const dataMigrationConfigDef = defineConfig(defaults, { label: "dataMigration" });

/** 上書きのファイルの型(`export default { ... } satisfies DataMigrationOverride`) */
export type DataMigrationOverride<E extends object = Record<never, never>> = OverrideOf<typeof dataMigrationConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const dataMigrationConfig: DataMigrationSettings = dataMigrationConfigDef.compose(override);
