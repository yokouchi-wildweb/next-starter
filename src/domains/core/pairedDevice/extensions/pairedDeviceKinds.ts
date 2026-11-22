// 生成物・編集不可: pnpm generate extensions が src/domains/core/pairedDevice/extensionPoints.ts から生成する
// pairedDeviceKinds: 差す側の <ドメイン>/plugs/pairedDeviceKinds/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const kind(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AnyPairedDeviceKindDefinition } from "@/domains/pairedDevice/types/kind";

/** 項目の kind の字面(全体で一意) */
export type PairedDeviceKindsKey = never;

const pairedDeviceKindsMap = {} as const satisfies Readonly<Record<string, AnyPairedDeviceKindDefinition>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type PairedDeviceKindsMap = typeof pairedDeviceKindsMap;
export const pairedDeviceKinds: { domain: string | null; name: string; requires: readonly string[]; plug: AnyPairedDeviceKindDefinition }[] = [];
