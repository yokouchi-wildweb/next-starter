// src/registry/pairedDeviceKindRegistry.ts
//
// 登録端末（pairedDevice）の種類（kind）の登録簿。サーバー専用。
// interactionTargetRegistry と同じ「中央レジストリを下流が編集する」方式。
//
// fail-closed: ここに登録されていない kind の端末は作成できず、認証にも失敗する。
// scope はアップストリームから見て中身を持たない JSONB で、形は kind ごとの scopeSchema が決める。
//
// 登録例（下流）:
//   import { z } from "zod";
//   import { definePairedDeviceKind } from "@/features/core/pairedDevice/types/kind";
//
//   table_terminal: definePairedDeviceKind({
//     label: "テーブル端末",
//     scopeSchema: z.object({ storeId: z.string().uuid(), tableId: z.string().min(1) }),
//     // 店長は自分の店舗の端末だけ管理できる（省略時は admin カテゴリのみ）
//     manageableScopes: async (user) =>
//       (await storeStaffService.managedStoreIds(user.userId)).map((storeId) => ({ storeId })),
//   }),
//
// 詳細: src/features/core/pairedDevice/README.md

import type { z } from "zod";

import type { PairedDeviceKindDefinition } from "@/features/core/pairedDevice/types/kind";

export const pairedDeviceKindRegistry = {
  // --- ここに端末の種類を登録する（上流は空。下流が追記） ---
} satisfies Record<string, PairedDeviceKindDefinition<any>>; // scope の型は kind ごとに異なる

/** 登録済みの kind 名 */
export type PairedDeviceKind = Extract<keyof typeof pairedDeviceKindRegistry, string>;

/** kind ごとの scope の型（scopeSchema から推論） */
export type PairedDeviceScopeOf<K extends PairedDeviceKind> =
  (typeof pairedDeviceKindRegistry)[K] extends { scopeSchema: infer S }
    ? S extends z.ZodTypeAny
      ? z.infer<S>
      : unknown
    : unknown;
