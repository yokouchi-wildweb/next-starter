// src/registry/reservedUserNamesRegistry.ts
//
// 表示名（ユーザー名）の「予約名」プロバイダの中央レジストリ。
// 特定ドメイン（user）の拡張口。userVisibleAuditActionsRegistry と同じく下流がここに追記する（サーバー専用）。
// serviceRegistry（ドメインを作ると 1 行増える一覧。生成物）とは役割が違う。
//
// users テーブル外で表示名を占有する存在をここに登録すると、表示名の一意性チェック
// (USER_NAME_CONFIG.unique 有効時) が users スキャンに加えてプロバイダも照会するようになる。
// 典型例:
// - ボット / NPC / 合成ランキングエントリなど、実ユーザーの隣に表示される非ユーザー名
// - 「運営」「admin」「公式」等の予約語・なりすまし対策リスト
//
// 挙動:
// - 上流は空 = 挙動変化ゼロ。登録した下流だけがコストを払う
// - 照会は users スキャンで重複が見つからなかった名前についてのみ行われる
// - findAvailableSuffixedUserName（restore 衝突時・dedup のサフィックス採番）も予約名を回避する
//
// 実装規約は ReservedUserNameProvider (features/core/user/types) の JSDoc を参照。
// 特に: advisory lock 中に呼ばれるため高速なローカル DB 参照に限ること。
//
// 登録例（下流ドメイン）:
//   import { namePoolReservedNamesProvider } from "@/features/namePool/services/server/reservedNames";
//   export const RESERVED_USER_NAME_PROVIDERS: readonly ReservedUserNameProvider[] = [
//     namePoolReservedNamesProvider,
//     { key: "static-reserved-words",
//       filterReserved: async (names) => names.filter((n) => ["運営", "admin"].includes(n)) },
//   ];

import type { ReservedUserNameProvider } from "@/features/core/user/types";

// --- fork entries start (upstream never edits inside) ---
// --- fork entries end ---

export const RESERVED_USER_NAME_PROVIDERS: readonly ReservedUserNameProvider[] = [
  // ここに予約名プロバイダを登録する
  // --- fork entries start (upstream never edits inside) ---
  // --- fork entries end ---
];
