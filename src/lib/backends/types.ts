// src/lib/backends/types.ts
// 口(port)の実装の宣言と本体の型(D29)。宣言は字面だけで書き、生成器と検査が構文木で読む(実行しない)
// 宣言の鍵: provides・requires・billing・env(要る)、requiresFeatures(任意、選んだときに開いていなければならない機能の名前)

/** 能力の名前 = "<口>.<語>"。語は口の持ち主の選ぶ点の宣言と増設点 backendCapabilities が持つ */
export type CapabilityName = `${string}.${string}`;

/** 機能の名前(門番の規則の名前の字面。lib/backends は門番もドメインも読まない、照らすのは選択表の検査) */
export type FeatureName = string;

/** 課金の目盛りの種類 */
export type BillingKind = "none" | "fixed" | "mau" | "perRecipient" | "egress" | "usage";

/**
 * 課金の目盛り 1 つ。"none" は配列の中で単独だけ(検査が止める)。
 * unit = 従量の単位(message・request・gbMonth・sms 等、"usage" で必須)、priceKey = 単価の表の行の鍵
 */
export type BillingScale =
  | { kind: Exclude<BillingKind, "usage">; unit?: string; priceKey?: string }
  | { kind: "usage"; unit: string; priceKey?: string };

/** 資格の env の名前(名前だけ、手引きと報告用。判定の正は adapter.isConfigured) */
export type BackendEnv = {
  required: readonly string[];
  optional?: readonly string[];
};

/**
 * 口の実装の宣言(<持ち主>/plugs/<点>/<名前>.ts の export const declaration)。字面だけ、ほかの鍵は止める
 */
export type BackendDeclaration = {
  /** この実装が出す能力 */
  provides: readonly CapabilityName[];
  /** この実装が動くのに要るほかの口の能力 */
  requires: readonly CapabilityName[];
  /** 課金の目盛りの配列 */
  billing: readonly BillingScale[];
  env: BackendEnv;
  /** この実装を選んだときに開いていなければならない機能の名前(省略 = 無い)。閉・不明・読めなければ選択表の検査が止める */
  requiresFeatures?: readonly FeatureName[];
};

/** isConfigured の戻り値。missing = 足りない env・設定の名前(値は持たない) */
export type IsConfiguredResult = { configured: true } | { configured: false; missing: readonly string[] };

/**
 * 口の状態(D49): 選ぶ点の持ち主が公開の入口から <点>BackendStatus として出す。起動時の知らせ(createBackendStatusTask)と道具が読む。
 * 送れる adapter は持たない(isConfigured だけ)
 */
export type BackendStatus = {
  /** 口の名前 */
  readonly port: string;
  /** 選択表が選んだ実装の名前(生成物の selected) */
  readonly selected: string;
  /** 選んだ実装の設定の揃い具合(env・設定の名前だけ、値は持たない) */
  isConfigured(): IsConfiguredResult;
};

/**
 * 口の実装の本体(<持ち主>/plugs/<点>/<名前>.ts の export const adapter)が必ず持つ形。
 * 口ごとの操作は口の持ち主の型がこれを広げて足す
 */
export type BackendAdapter = {
  /** 設定が揃っているか(同期、通信しない、SDK を初期化しない) */
  isConfigured(): IsConfiguredResult;
};

/**
 * 今の設定の読み方(選ぶ点の宣言の compat、字面だけ)。口を足す移行の道具が足りない選択表の鍵を書くときに読む
 * - env: その env の値を map で実装の名前に写す(無い・知らない値は default)
 * - fixed: いつも value
 */
export type BackendCompat =
  | { from: "env"; name: string; map: Readonly<Record<string, string>>; default: string }
  | { from: "fixed"; value: string };

/** 業務コードが要る能力(ドメインの字面の宣言 backendRequirements)。開いているドメインの分だけ選択表の provides と照らす */
export type BackendRequirements = readonly CapabilityName[];

/** 増設点 backendCapabilities の項目(<持ち主>/plugs/backendCapabilities/<名前>.ts の export const capabilities、字面だけ) */
export type BackendCapabilityItem = {
  /** 口の名前 */
  port: string;
  /** その口に足す能力の語(能力の名前は "<port>.<語>") */
  words: readonly string[];
};
