// src/features/core/pairedDevice/types/kinds.ts
// 登録済みの端末の種類から導く型（一覧 ../extensions/kinds.ts の型だけを読む）

import type { kinds } from "@/features/core/pairedDevice/extensions/kinds";

import type { PairedDeviceKindNamesOf, PairedDeviceScopeIn } from "./kind";

/** 登録済みの kind 名 */
export type PairedDeviceKind = PairedDeviceKindNamesOf<typeof kinds>;

/** kind ごとの scope の型（scopeSchema から推論） */
export type PairedDeviceScopeOf<K extends PairedDeviceKind> = PairedDeviceScopeIn<typeof kinds, K>;
