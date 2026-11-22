// src/domains/core/pairedDevice/types/kinds.ts
// 登録済みの端末の種類から導く型（点 pairedDeviceKinds の生成の一覧 ../extensions/pairedDeviceKinds.ts の型だけを読む）

import type { PairedDeviceKindsMap } from "@/domains/pairedDevice/extensions/pairedDeviceKinds";

import type { PairedDeviceKindNamesOf, PairedDeviceScopeIn } from "./kind";

/** kind の値を鍵にした項目の型(項目のファイル名でなく definePairedDeviceKind の kind で引く) */
type KindsByKind = { readonly [I in PairedDeviceKindsMap[keyof PairedDeviceKindsMap] as I["kind"]]: I };

/** 登録済みの kind 名 */
export type PairedDeviceKind = PairedDeviceKindNamesOf<KindsByKind>;

/** kind ごとの scope の型（scopeSchema から推論） */
export type PairedDeviceScopeOf<K extends PairedDeviceKind> = PairedDeviceScopeIn<KindsByKind, K>;
